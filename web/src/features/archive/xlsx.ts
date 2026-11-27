import ExcelJS from "exceljs";

export const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type XlsxCell = string | number | null;

export type SheetSpec = {
  name: string;
  headers: string[];
  rows: XlsxCell[][];
  /** 1 tabanlı sütun numaraları; `#,##0.00` biçimi uygulanır. */
  moneyColumns?: number[];
  /** 1 tabanlı sütun numaraları; değer zaten yüzde sayısıdır (42.9), `0.0" %"` biçimi uygulanır (bölme yok). */
  percentColumns?: number[];
  /** 1 tabanlı satır numarası (başlık = 1) → "Değer" (2. sütun) hücre biçimi; karışık değerli sütunlar için. */
  rowFormats?: Record<number, string>;
};

export const MONEY_FORMAT = "#,##0.00";
export const PERCENT_FORMAT = '0.0" %"';

/**
 * Para dizgesini Excel sayı hücresine çevirir (Karar 16). `numeric(12,2)` en çok 12 basamaktır,
 * `double`'da tam gösterilir; bu, para değerinde `Number` kullanılan tek yerdir ve hesap yapılmaz.
 */
export function moneyCell(amount: string | null): number | null {
  return amount === null ? null : Number(amount);
}

/** Metin hücreleri düz dizgi olarak yazılır (formül nesnesi yok); başlık kalın, ilk satır dondurulmuş. */
export async function buildWorkbook(sheets: SheetSpec[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  for (const spec of sheets) {
    const sheet = workbook.addWorksheet(spec.name);
    sheet.addRow(spec.headers);
    for (const row of spec.rows) sheet.addRow(row);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column) => {
      column.width = 20;
    });
    for (const index of spec.moneyColumns ?? []) sheet.getColumn(index).numFmt = MONEY_FORMAT;
    for (const index of spec.percentColumns ?? []) sheet.getColumn(index).numFmt = PERCENT_FORMAT;
    for (const [rowNumber, format] of Object.entries(spec.rowFormats ?? {})) {
      sheet.getRow(Number(rowNumber)).getCell(2).numFmt = format;
    }
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
