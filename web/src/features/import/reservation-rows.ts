import { createReservationInput, type CreateReservationInput } from "@/features/reservations/schemas";
import { RESERVATION_COLUMNS, type ReservationColumn } from "./columns";
import { mapHeaders, normalizeKey } from "./headers";
import type { SheetData } from "./xlsx-reader";

export type ParsedReservationRow = {
  row: number;
  tableLabel: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  guestCount: string;
  note: string;
};

/** Başlıkları eşler ve satırları ham metin olarak döndürür (doğrulama ayrı: `checkReservationRow`). */
export function parseReservationRows(sheet: SheetData): ParsedReservationRow[] {
  const columns = mapHeaders(sheet.headers, RESERVATION_COLUMNS);
  const get = (cells: string[], key: ReservationColumn): string => {
    const index = columns.get(key);
    return index === undefined ? "" : (cells[index] ?? "");
  };
  return sheet.rows.map(({ row, cells }) => ({
    row,
    tableLabel: get(cells, "tableLabel"),
    guestName: get(cells, "guestName"),
    guestPhone: get(cells, "guestPhone"),
    guestEmail: get(cells, "guestEmail"),
    guestCount: get(cells, "guestCount"),
    note: get(cells, "note"),
  }));
}

export type TableInfo = { id: string; label: string; capacity: number };

/** Etiket → masa. Tam eşleşme önce; yoksa büyük/küçük harf ve boşluk farkı yok sayılarak (yalnızca tekse). */
export class TableIndex {
  private readonly exact = new Map<string, TableInfo>();
  private readonly folded = new Map<string, TableInfo | null>();

  constructor(tables: readonly TableInfo[]) {
    for (const table of tables) {
      this.exact.set(table.label.trim(), table);
      const key = normalizeKey(table.label);
      this.folded.set(key, this.folded.has(key) ? null : table);
    }
  }

  /** `undefined`: yok; `null`: birden fazla masayla eşleşiyor. */
  find(label: string): TableInfo | null | undefined {
    return this.exact.get(label.trim()) ?? this.folded.get(normalizeKey(label));
  }
}

export type RowCheck = { ok: true; table: TableInfo; input: CreateReservationInput } | { ok: false; message: string };

const tableNotFound = (label: string) => `Masa bu etkinlikte bulunamadı: "${label}"`;

/** Satırı tek başına doğrular (veritabanı durumuna bakmaz; müsaitlik/kapasite/kara liste servis işidir). */
export function checkReservationRow(eventId: string, tables: TableIndex, row: ParsedReservationRow): RowCheck {
  if (row.tableLabel === "") return { ok: false, message: "Masa etiketi boş" };
  if (row.guestName === "") return { ok: false, message: "Misafir adı boş" };
  const table = tables.find(row.tableLabel);
  if (table === undefined) return { ok: false, message: tableNotFound(row.tableLabel) };
  if (table === null) return { ok: false, message: `Masa etiketi birden fazla masayla eşleşiyor: "${row.tableLabel}"` };

  const parsed = createReservationInput.safeParse({
    eventId,
    tableId: table.id,
    guestCount: row.guestCount,
    guestName: row.guestName,
    guestPhone: row.guestPhone,
    guestEmail: row.guestEmail,
    specialRequests: row.note,
  });
  if (!parsed.success) {
    const messages = [...new Set(parsed.error.issues.map((issue) => issue.message))];
    return { ok: false, message: messages.join("; ") };
  }
  return { ok: true, table, input: parsed.data };
}
