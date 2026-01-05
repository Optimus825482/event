import { Injectable, Logger } from "@nestjs/common";
import * as XLSX from "xlsx";

// Dönüştürülmüş Excel verisi
export interface ConvertedExcelData {
  // CSV formatında tüm veri
  csv: string;
  // JSON formatında satırlar (kolon indeksleri ile)
  rows: ExcelRow[];
  // Tespit edilen bölümler
  sections: DetectedSection[];
  // Meta bilgiler
  meta: {
    totalRows: number;
    totalColumns: number;
    sheetName: string;
    nonEmptyRows: number;
  };
}

export interface ExcelRow {
  rowIndex: number;
  cells: ExcelCell[];
  rawText: string; // Tüm hücrelerin birleşimi
  sectionType?: SectionType;
}

export interface ExcelCell {
  colIndex: number;
  colLetter: string; // A, B, C...
  value: string;
  isNumeric: boolean;
  isTime: boolean;
  isEmpty: boolean;
}

export type SectionType =
  | "header"
  | "captain"
  | "supervisor"
  | "loca_captain"
  | "table_assignment"
  | "extra_personnel"
  | "support_team"
  | "service_point"
  | "unknown";

export interface DetectedSection {
  type: SectionType;
  startRow: number;
  endRow: number;
  title?: string;
  rows: ExcelRow[];
}

@Injectable()
export class ExcelConverterService {
  private readonly logger = new Logger(ExcelConverterService.name);

  /**
   * Excel dosyasını yapılandırılmış formata çevir
   */
  convertExcel(filePath: string): ConvertedExcelData {
    this.logger.log(`Converting Excel file: ${filePath}`);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Ham veriyi al
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // CSV formatına çevir
    const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ";", RS: "\n" });

    // Satırları işle
    const rows = this.processRows(rawData);

    // Bölümleri tespit et
    const sections = this.detectSections(rows);

    const meta = {
      totalRows: rawData.length,
      totalColumns: Math.max(...rawData.map((r) => r?.length || 0)),
      sheetName,
      nonEmptyRows: rows.length,
    };

    this.logger.log(
      `Converted: ${meta.nonEmptyRows} rows, ${sections.length} sections detected`
    );

    return { csv, rows, sections, meta };
  }

  /**
   * Ham satırları işle ve yapılandır
   */
  private processRows(rawData: any[][]): ExcelRow[] {
    const rows: ExcelRow[] = [];

    for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      if (!row || row.length === 0) continue;

      const cells: ExcelCell[] = [];
      const textParts: string[] = [];

      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const rawValue = row[colIndex];
        const value = this.cleanValue(rawValue);

        if (value) {
          const cell: ExcelCell = {
            colIndex,
            colLetter: this.getColumnLetter(colIndex),
            value,
            isNumeric: this.isNumeric(value),
            isTime: this.isTimeFormat(value),
            isEmpty: false,
          };
          cells.push(cell);
          textParts.push(value);
        }
      }

      if (cells.length > 0) {
        rows.push({
          rowIndex,
          cells,
          rawText: textParts.join(" | "),
        });
      }
    }

    return rows;
  }

  /**
   * Bölümleri tespit et
   */
  private detectSections(rows: ExcelRow[]): DetectedSection[] {
    const sections: DetectedSection[] = [];
    let currentSection: DetectedSection | null = null;

    for (const row of rows) {
      const sectionType = this.detectSectionType(row);
      row.sectionType = sectionType;

      // Yeni bölüm başlığı tespit edildi
      if (this.isSectionHeader(row, sectionType)) {
        // Önceki bölümü kapat
        if (currentSection) {
          currentSection.endRow = row.rowIndex - 1;
          sections.push(currentSection);
        }

        // Yeni bölüm başlat
        currentSection = {
          type: sectionType,
          startRow: row.rowIndex,
          endRow: row.rowIndex,
          title: this.extractSectionTitle(row),
          rows: [row],
        };
      } else if (currentSection) {
        // Mevcut bölüme ekle
        currentSection.rows.push(row);
        currentSection.endRow = row.rowIndex;
      } else {
        // Bölüm dışı satır - table_assignment olarak varsay
        currentSection = {
          type: "table_assignment",
          startRow: row.rowIndex,
          endRow: row.rowIndex,
          rows: [row],
        };
      }
    }

    // Son bölümü ekle
    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Satırın bölüm tipini tespit et
   */
  private detectSectionType(row: ExcelRow): SectionType {
    const text = row.rawText.toUpperCase();

    // Kaptan tespiti
    if (
      text.includes("CAPTAIN") ||
      text.includes("J. CAPTAIN") ||
      text.includes("INCHARGE")
    ) {
      return "captain";
    }

    // Süpervizör tespiti
    if (text.includes("SPVR") || text.includes("SUPERVISOR")) {
      return "supervisor";
    }

    // Loca kaptanı tespiti
    if (
      (text.includes("LOCA") && !text.match(/LOCA\s*\d/)) ||
      text === "LOCA"
    ) {
      return "loca_captain";
    }

    // Extra personel tespiti
    if (text.includes("EXTRA") && text.includes("PERSONEL")) {
      return "extra_personnel";
    }

    // Destek ekibi tespiti
    if (text.includes("DESTEK") && text.includes("EKİBİ")) {
      return "support_team";
    }

    // Hizmet noktası tespiti
    if (
      text.includes("BAR") ||
      text.includes("DEPO") ||
      text.includes("FUAYE") ||
      text.includes("CASINO")
    ) {
      return "service_point";
    }

    // Başlık satırı tespiti
    if (
      text.includes("POZİSYON") ||
      text.includes("PERSONEL") ||
      text.includes("POSTA") ||
      text.includes("SAAT")
    ) {
      return "header";
    }

    return "table_assignment";
  }

  /**
   * Satır bir bölüm başlığı mı?
   */
  private isSectionHeader(row: ExcelRow, sectionType: SectionType): boolean {
    const text = row.rawText.toUpperCase();

    switch (sectionType) {
      case "extra_personnel":
        return text.includes("EXTRA") && text.includes("PERSONEL");
      case "support_team":
        return text.includes("DESTEK") && text.includes("EKİBİ");
      case "service_point":
        // BAR, DEPO gibi başlıklar genelde tek kelime
        return (
          row.cells.length <= 3 &&
          (text.includes("BAR") ||
            text.includes("DEPO") ||
            text.includes("FUAYE"))
        );
      case "loca_captain":
        return (
          text === "LOCA" || (text.includes("LOCA") && row.cells.length <= 2)
        );
      default:
        return false;
    }
  }

  /**
   * Bölüm başlığını çıkar
   */
  private extractSectionTitle(row: ExcelRow): string {
    return row.rawText;
  }

  /**
   * Hücre değerini temizle
   */
  private cleanValue(value: any): string {
    if (value === undefined || value === null) return "";
    return String(value).trim();
  }

  /**
   * Kolon indeksini harf formatına çevir (0 -> A, 1 -> B, 26 -> AA)
   */
  private getColumnLetter(index: number): string {
    let letter = "";
    while (index >= 0) {
      letter = String.fromCharCode((index % 26) + 65) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  }

  /**
   * Değer sayısal mı?
   */
  private isNumeric(value: string): boolean {
    return /^\d+$/.test(value.replace(/[-\s]/g, ""));
  }

  /**
   * Değer saat formatında mı?
   */
  private isTimeFormat(value: string): boolean {
    return /^\d{1,2}[:.]\d{2}/.test(value) || /\d{1,2}:\d{2}/.test(value);
  }

  /**
   * Excel'i AI için optimize edilmiş text formatına çevir
   */
  convertToAIFormat(data: ConvertedExcelData): string {
    const lines: string[] = [];

    lines.push("=== EXCEL VERİSİ ===\n");

    for (const section of data.sections) {
      lines.push(
        `\n--- ${section.type.toUpperCase()} (Satır ${section.startRow}-${
          section.endRow
        }) ---`
      );
      if (section.title) {
        lines.push(`Başlık: ${section.title}`);
      }

      for (const row of section.rows) {
        const cellsStr = row.cells
          .map((c) => `${c.colLetter}:${c.value}`)
          .join(" | ");
        lines.push(`[${row.rowIndex}] ${cellsStr}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Excel'i JSON formatına çevir (programatik işleme için)
   */
  convertToJSON(data: ConvertedExcelData): object {
    return {
      meta: data.meta,
      sections: data.sections.map((s) => ({
        type: s.type,
        title: s.title,
        rowRange: [s.startRow, s.endRow],
        data: s.rows.map((r) => ({
          row: r.rowIndex,
          cells: Object.fromEntries(r.cells.map((c) => [c.colLetter, c.value])),
        })),
      })),
    };
  }

  /**
   * Belirli bir bölümü çıkar
   */
  extractSection(
    data: ConvertedExcelData,
    sectionType: SectionType
  ): DetectedSection | undefined {
    return data.sections.find((s) => s.type === sectionType);
  }

  /**
   * Tüm bölümleri belirli tipe göre filtrele
   */
  extractSections(
    data: ConvertedExcelData,
    sectionType: SectionType
  ): DetectedSection[] {
    return data.sections.filter((s) => s.type === sectionType);
  }

  /**
   * Personel isimlerini çıkar (tüm bölümlerden)
   */
  extractAllStaffNames(data: ConvertedExcelData): string[] {
    const names = new Set<string>();

    for (const section of data.sections) {
      for (const row of section.rows) {
        // İsim genelde ilk veya ikinci hücrede
        for (const cell of row.cells.slice(0, 3)) {
          if (this.looksLikeName(cell.value)) {
            names.add(cell.value);
          }
        }
      }
    }

    return Array.from(names);
  }

  /**
   * Değer bir isim gibi görünüyor mu?
   */
  private looksLikeName(value: string): boolean {
    // En az 2 karakter, sayı içermeyen, büyük harfle başlayan
    if (value.length < 2) return false;
    if (/\d/.test(value)) return false;
    if (!/^[A-ZÇĞİÖŞÜ]/.test(value)) return false;

    // Bilinen başlıkları hariç tut
    const excludeWords = [
      "PERSONEL",
      "POZİSYON",
      "POSTA",
      "SAAT",
      "MASA",
      "LOCA",
      "BAR",
      "DEPO",
      "EXTRA",
      "DESTEK",
      "EKİBİ",
      "CAPTAIN",
      "SPVR",
      "INCHARGE",
    ];

    return !excludeWords.includes(value.toUpperCase());
  }
}
