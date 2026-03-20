import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Event } from "../../entities/event.entity";
import {
  Reservation,
  ReservationStatus,
} from "../../entities/reservation.entity";
import { Customer } from "../../entities/customer.entity";
import * as ExcelJS from "exceljs";

export interface ParsedReservationEntry {
  guestName: string;
  guestCount: number;
  tableLabel: string; // "LOCA 1", "MASA 5" etc.
  tableId?: string; // matched table ID from event layout
  status: "matched" | "unmatched" | "warning";
  warning?: string;
}

export interface ReservationImportPreview {
  totalEntries: number;
  matchedTables: number;
  unmatchedTables: number;
  totalGuests: number;
  entries: ParsedReservationEntry[];
  availableTables: {
    id: string;
    label: string;
    capacity: number;
    tableNumber?: number;
    locaName?: string;
    isLoca?: boolean;
  }[];
  warnings: string[];
}

export interface ReservationImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

@Injectable()
export class ReservationImportService {
  private readonly logger = new Logger(ReservationImportService.name);

  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) {}

  // Parse the Excel file and return preview data
  async analyzeReservationExcel(
    eventId: string,
    filePath: string,
  ): Promise<ReservationImportPreview> {
    // 1. Load event and get venue layout tables
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event) throw new Error("Event bulunamadı");

    const layout = event.venueLayout as any;
    const layoutTables: any[] = layout?.placedTables || layout?.tables || [];
    const availableTables = layoutTables.map((t: any) => {
      let label: string;
      if (t.isLoca || t.type === "loca") {
        label = t.locaName
          ? `LOCA ${t.locaName}`
          : t.label || `Loca ${t.id.split("-").pop()}`;
      } else {
        label =
          t.label ||
          (t.tableNumber != null
            ? `MASA ${t.tableNumber}`
            : `Masa ${t.id.split("-").pop()}`);
      }
      return {
        id: t.id,
        label,
        capacity: t.capacity || 10,
        tableNumber: t.tableNumber,
        locaName: t.locaName,
        isLoca: !!(t.isLoca || t.type === "loca"),
      };
    });

    // 2. Parse Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const entries: ParsedReservationEntry[] = [];
    const warnings: string[] = [];

    // Track current table headers per column (A=1, B=2, ..., F=6)
    const currentHeaders: (string | null)[] = [
      null,
      null,
      null,
      null,
      null,
      null,
    ];

    worksheet.eachRow((row, rowNumber) => {
      for (let colIdx = 1; colIdx <= 6; colIdx++) {
        const cellValue = row.getCell(colIdx).value;
        if (cellValue === null || cellValue === undefined) continue;

        const cellStr = String(cellValue).trim();
        if (!cellStr) continue;

        // Check if this is a table/loca header
        if (this.isTableHeader(cellStr)) {
          currentHeaders[colIdx - 1] = cellStr;
          continue;
        }

        // Skip special values
        if (this.isSkippableValue(cellStr)) continue;

        // Skip pure numbers
        if (/^\d+$/.test(cellStr)) continue;

        // This is a guest entry
        const tableLabel = currentHeaders[colIdx - 1];
        if (!tableLabel) {
          warnings.push(
            `Satır ${rowNumber}, Sütun ${colIdx}: "${cellStr}" için masa başlığı bulunamadı`,
          );
          continue;
        }

        const { name, count } = this.parseGuestEntry(cellStr);
        if (!name) continue;

        // Try to match table label to event layout
        const matchedTable = this.matchTableLabel(tableLabel, availableTables);

        entries.push({
          guestName: name,
          guestCount: count,
          tableLabel: tableLabel,
          tableId: matchedTable?.id,
          status: matchedTable ? "matched" : "unmatched",
          warning: matchedTable
            ? undefined
            : `"${tableLabel}" etkinlik yerleşiminde bulunamadı — lütfen manuel olarak masa atayın`,
        });
      }
    });

    const matchedCount = entries.filter((e) => e.status === "matched").length;
    const unmatchedCount = entries.filter(
      (e) => e.status === "unmatched",
    ).length;
    const totalGuests = entries.reduce((sum, e) => sum + e.guestCount, 0);

    return {
      totalEntries: entries.length,
      matchedTables: matchedCount,
      unmatchedTables: unmatchedCount,
      totalGuests,
      entries,
      availableTables,
      warnings,
    };
  }

  // Confirm and save the import
  async confirmReservationImport(
    eventId: string,
    entries: ParsedReservationEntry[],
    options?: { clearExisting?: boolean },
  ): Promise<ReservationImportResult> {
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Optionally clear existing reservations
    if (options?.clearExisting) {
      await this.reservationRepository.update(
        { eventId, status: ReservationStatus.CONFIRMED },
        { status: ReservationStatus.CANCELLED },
      );
    }

    for (const entry of entries) {
      try {
        if (!entry.tableId) {
          skipped++;
          continue;
        }

        // Check if table already has an active reservation
        const existing = await this.reservationRepository.findOne({
          where: {
            eventId,
            tableId: entry.tableId,
            status: ReservationStatus.CONFIRMED,
          },
        });

        if (existing) {
          skipped++;
          errors.push(
            `${entry.tableLabel}: Zaten rezervasyon var (${existing.guestName || "Misafir"})`,
          );
          continue;
        }

        // Try to find or create customer
        let customerId: string | null = null;
        const existingCustomer = await this.customerRepository.findOne({
          where: { fullName: entry.guestName },
        });

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const newCustomer = this.customerRepository.create({
            fullName: entry.guestName,
          });
          const saved = await this.customerRepository.save(newCustomer);
          customerId = saved.id;
        }

        // Generate a simple QR hash
        const qrCodeHash = `${eventId}-${entry.tableId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create reservation
        const reservation = this.reservationRepository.create({
          eventId,
          tableId: entry.tableId,
          customerId,
          guestName: entry.guestName,
          guestCount: entry.guestCount,
          qrCodeHash,
          status: ReservationStatus.CONFIRMED,
        });

        await this.reservationRepository.save(reservation);
        created++;
      } catch (err) {
        errors.push(`${entry.guestName} (${entry.tableLabel}): ${err.message}`);
      }
    }

    return { created, skipped, errors };
  }

  // Helper: Check if cell value is a table/loca header
  private isTableHeader(value: string): boolean {
    return /^(LOCA|MASA)\s+\d+[A-Z]*/i.test(value);
  }

  // Helper: Check if value should be skipped
  private isSkippableValue(value: string): boolean {
    const skipList = ["CRYSTAL", "BASIN", "SANDALYE", "OPS"];
    const upper = value.toUpperCase().trim();
    return skipList.some((s) => upper.startsWith(s));
  }

  // Helper: Parse guest name and count from entry like "MURAT DESTE 5"
  private parseGuestEntry(value: string): { name: string; count: number } {
    const trimmed = value.trim();
    // Match: name followed by optional space and number at end
    const match = trimmed.match(/^(.+?)\s+(\d+)\s*$/);
    if (match) {
      const name = match[1].trim();
      const count = parseInt(match[2], 10);
      // Sanity check: if count > 50, it's probably part of the name
      if (count <= 50 && count >= 1) {
        return { name, count };
      }
    }
    // No number suffix — default to 1
    return { name: trimmed, count: 1 };
  }

  // Helper: Match table label from Excel to event layout tables
  private matchTableLabel(
    label: string,
    tables: {
      id: string;
      label: string;
      capacity: number;
      tableNumber?: number;
      locaName?: string;
      isLoca?: boolean;
    }[],
  ): { id: string; label: string; capacity: number } | null {
    const normalized = label.toUpperCase().replace(/\s+/g, " ").trim();
    const isLoca = normalized.startsWith("LOCA");

    // Extract the number/identifier part: "MASA 66" -> "66", "LOCA 5A" -> "5A"
    const identMatch = normalized.match(/^(?:MASA|LOCA)\s+(.+)$/);
    if (!identMatch) return null;
    const identifier = identMatch[1].trim();

    if (isLoca) {
      // Match by locaName first
      const match = tables.find(
        (t) =>
          t.isLoca &&
          t.locaName != null &&
          String(t.locaName).toUpperCase().trim() === identifier,
      );
      if (match) return match;
    } else {
      // Match by tableNumber first
      const num = parseInt(identifier, 10);
      if (!isNaN(num)) {
        const match = tables.find(
          (t) => !t.isLoca && t.tableNumber != null && t.tableNumber === num,
        );
        if (match) return match;
      }
    }

    // Fallback: exact label match
    let match = tables.find(
      (t) => t.label.toUpperCase().replace(/\s+/g, " ").trim() === normalized,
    );
    if (match) return match;

    // Fallback: label without spaces
    const noSpace = normalized.replace(/\s+/g, "");
    match = tables.find(
      (t) => t.label.toUpperCase().replace(/\s+/g, "") === noSpace,
    );
    if (match) return match;

    return null;
  }
}
