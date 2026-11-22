import ExcelJS from "exceljs";
import { DomainError } from "@/lib/action";
import {
  MAX_CELL_LENGTH,
  MAX_COLUMNS,
  MAX_DATA_ROWS,
  MAX_FILE_BYTES,
  MAX_SCAN_ROWS,
  MAX_UNCOMPRESSED_BYTES,
  MAX_ZIP_ENTRIES,
} from "./limits";

export type SheetRow = { row: number; cells: string[] };
export type SheetData = { headers: string[]; rows: SheetRow[] };

const NOT_XLSX = "Dosya geçerli bir .xlsx çalışma kitabı değil";
const TOO_BIG = "Dosya açıldığında izin verilenden çok büyük; içe aktarılamaz";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

/** ZIP yerel başlık imzası: "PK\x03\x04". Uzantıya değil içeriğe bakılır. */
function hasZipSignature(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/**
 * Sıkıştırma bombasına karşı ön denetim: ZIP'in merkezi dizinini (içerik açılmadan) okuyup girdi
 * sayısını ve bildirilen açılmış boyutların toplamını sınırlar. Bildirilen boyutun gerçekle
 * uyuşmadığı arşivleri açma katmanı (jszip) zaten reddeder.
 */
function assertZipWithinLimits(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const lowest = Math.max(0, bytes.length - 22 - 0xffff);
  for (let i = bytes.length - 22; i >= lowest; i -= 1) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new DomainError("invalid", NOT_XLSX);

  const entryCount = view.getUint16(eocd + 10, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (entryCount === 0xffff || directoryOffset === 0xffffffff) throw new DomainError("invalid", TOO_BIG);
  if (entryCount > MAX_ZIP_ENTRIES) throw new DomainError("invalid", TOO_BIG);

  let offset = directoryOffset;
  let total = 0;
  for (let i = 0; i < entryCount; i += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw new DomainError("invalid", NOT_XLSX);
    }
    const size = view.getUint32(offset + 24, true);
    if (size === 0xffffffff) throw new DomainError("invalid", TOO_BIG);
    total += size;
    if (total > MAX_UNCOMPRESSED_BYTES) throw new DomainError("invalid", TOO_BIG);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    offset += 46 + nameLength + extraLength + commentLength;
  }
}

/** Hücre değerini düz metne çevirir. Formüller değerlendirilmez; saklanan sonuç okunur. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  if ("result" in value) return cellText(value.result ?? null);
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("text" in value) return cellText(value.text);
  return "";
}

function isControl(code: number): boolean {
  return (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f;
}

/** Denetim karakterlerini ayıklar, kırpar ve uzunluğu sınırlar. */
function clean(text: string): string {
  let out = "";
  for (const ch of text.slice(0, MAX_CELL_LENGTH * 2)) {
    if (!isControl(ch.charCodeAt(0))) out += ch;
  }
  return out.trim().slice(0, MAX_CELL_LENGTH);
}

/**
 * Yalnızca ilk çalışma sayfasını okur. İlk dolu satır başlık satırıdır; tamamen boş satırlar atlanır.
 * Sınırlar: dosya boyutu, ZIP imzası, açılmış boyut, en çok {@link MAX_DATA_ROWS} veri satırı.
 */
export async function readFirstSheet(bytes: Uint8Array): Promise<SheetData> {
  if (bytes.length === 0) throw new DomainError("invalid", "Dosya boş");
  if (bytes.length > MAX_FILE_BYTES) {
    throw new DomainError("invalid", `Dosya ${MAX_FILE_BYTES / (1024 * 1024)} MB sınırını aşıyor`);
  }
  if (!hasZipSignature(bytes)) throw new DomainError("invalid", "Yalnızca .xlsx dosyaları kabul edilir");
  assertZipWithinLimits(bytes);

  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs'in eski `Buffer` tipi Node'un güncel tipiyle uyuşmuyor; çalışma zamanında aynı nesne.
    const input = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    await workbook.xlsx.load(input as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new DomainError("invalid", NOT_XLSX);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new DomainError("invalid", "Çalışma kitabında sayfa yok");
  if (sheet.rowCount > MAX_SCAN_ROWS) {
    throw new DomainError("invalid", `Sayfa en çok ${MAX_DATA_ROWS} veri satırı içerebilir`);
  }

  let headers: string[] | null = null;
  const rows: SheetRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      if (col <= MAX_COLUMNS) cells[col - 1] = clean(cellText(cell.value));
    });
    const filled = Array.from(cells, (c) => c ?? "");
    if (filled.every((c) => c === "")) return;
    if (headers === null) {
      headers = filled;
      return;
    }
    rows.push({ row: rowNumber, cells: filled });
  });

  if (headers === null) throw new DomainError("invalid", "Dosyada başlık satırı yok");
  if (rows.length > MAX_DATA_ROWS) {
    throw new DomainError("invalid", `Dosya en çok ${MAX_DATA_ROWS} veri satırı içerebilir (${rows.length} bulundu)`);
  }
  if (rows.length === 0) throw new DomainError("invalid", "Dosyada veri satırı yok");
  return { headers, rows };
}
