import zlib from "node:zlib";
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

const LOCAL_SIGNATURE = 0x04034b50;
const FLAG_ENCRYPTED = 0x1 | 0x40 | 0x2000;
const FLAG_DATA_DESCRIPTOR = 0x8;
const ZIP64_MARKER = 0xffffffff;

export type ReadOptions = { maxUncompressedBytes?: number };

function sameBytes(bytes: Uint8Array, a: number, b: number, length: number): boolean {
  for (let i = 0; i < length; i += 1) {
    if (bytes[a + i] !== bytes[b + i]) return false;
  }
  return true;
}

/**
 * Sıkıştırma bombasına karşı ön denetim: merkezi dizindeki her girdinin yerel başlığını bulur, girdiyi
 * kendisi açar (yalnızca kalan bütçe kadar çıktı üretilir) ve GERÇEK açılmış boyutların toplamını sınırlar.
 * Bildirilen boyut yalnızca güvenilmeyen bir ipucudur; gerçekle uyuşmayan, şifreli, ZIP64 veya desteklenmeyen
 * yöntemli arşivler reddedilir. ExcelJS bu denetimden geçmeden veriyi görmez.
 */
function assertZipWithinLimits(bytes: Uint8Array, maxBytes: number): void {
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
  if (entryCount === 0xffff || directoryOffset === ZIP64_MARKER) throw new DomainError("invalid", TOO_BIG);
  if (entryCount > MAX_ZIP_ENTRIES) throw new DomainError("invalid", TOO_BIG);

  let offset = directoryOffset;
  let declaredTotal = 0;
  let realTotal = 0;
  for (let i = 0; i < entryCount; i += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw new DomainError("invalid", NOT_XLSX);
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const declaredSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    if (declaredSize === ZIP64_MARKER || compressedSize === ZIP64_MARKER || localOffset === ZIP64_MARKER) {
      throw new DomainError("invalid", TOO_BIG);
    }
    declaredTotal += declaredSize;
    if (declaredTotal > maxBytes) throw new DomainError("invalid", TOO_BIG);
    if ((flags & FLAG_ENCRYPTED) !== 0 || (method !== 0 && method !== 8)) {
      throw new DomainError("invalid", NOT_XLSX);
    }
    if (offset + 46 + nameLength > bytes.length || localOffset + 30 > bytes.length) {
      throw new DomainError("invalid", NOT_XLSX);
    }
    if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) throw new DomainError("invalid", NOT_XLSX);

    const localFlags = view.getUint16(localOffset + 6, true);
    const localMethod = view.getUint16(localOffset + 8, true);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    if ((localFlags & FLAG_ENCRYPTED) !== 0 || localMethod !== method || localNameLength !== nameLength) {
      throw new DomainError("invalid", NOT_XLSX);
    }
    if (localOffset + 30 + nameLength > bytes.length || !sameBytes(bytes, offset + 46, localOffset + 30, nameLength)) {
      throw new DomainError("invalid", NOT_XLSX);
    }
    // Veri tanımlayıcılı girdilerde yerel başlıktaki boyutlar 0 olabilir; yoksa merkezi dizinle aynı olmalı.
    const localCompressed = view.getUint32(localOffset + 18, true);
    const localSize = view.getUint32(localOffset + 22, true);
    const hasDescriptor = (localFlags & FLAG_DATA_DESCRIPTOR) !== 0;
    const sizesAgree = localCompressed === compressedSize && localSize === declaredSize;
    const sizesZero = localCompressed === 0 && localSize === 0;
    if (!sizesAgree && !(hasDescriptor && sizesZero)) throw new DomainError("invalid", NOT_XLSX);

    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) throw new DomainError("invalid", NOT_XLSX);
    const data = bytes.subarray(dataStart, dataEnd);

    let realSize: number;
    if (method === 0) {
      realSize = data.length;
    } else {
      try {
        realSize = zlib.inflateRawSync(data, { maxOutputLength: Math.max(1, maxBytes - realTotal) }).length;
      } catch (error) {
        const code = (error as { code?: string }).code;
        throw new DomainError("invalid", code === "ERR_BUFFER_TOO_LARGE" ? TOO_BIG : NOT_XLSX);
      }
    }
    realTotal += realSize;
    if (realTotal > maxBytes) throw new DomainError("invalid", TOO_BIG);
    if (realSize !== declaredSize) throw new DomainError("invalid", NOT_XLSX);

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
export async function readFirstSheet(bytes: Uint8Array, options: ReadOptions = {}): Promise<SheetData> {
  if (bytes.length === 0) throw new DomainError("invalid", "Dosya boş");
  if (bytes.length > MAX_FILE_BYTES) {
    throw new DomainError("invalid", `Dosya ${MAX_FILE_BYTES / (1024 * 1024)} MB sınırını aşıyor`);
  }
  if (!hasZipSignature(bytes)) throw new DomainError("invalid", "Yalnızca .xlsx dosyaları kabul edilir");
  assertZipWithinLimits(bytes, options.maxUncompressedBytes ?? MAX_UNCOMPRESSED_BYTES);

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
