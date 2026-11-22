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
const FLAG_UTF8 = 0x800;
const ZIP64_MARKER = 0xffffffff;

export type ReadOptions = { maxUncompressedBytes?: number };

type ZipEntry = { name: Buffer; data: Buffer };

function sameBytes(bytes: Uint8Array, a: number, b: number, length: number): boolean {
  for (let i = 0; i < length; i += 1) {
    if (bytes[a + i] !== bytes[b + i]) return false;
  }
  return true;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Güvenli olmayan girdi adları: boş, mutlak, ters eğik çizgili veya `..` bölütlü. */
function assertSafeName(name: string): void {
  const unsafe = name === "" || name.startsWith("/") || name.includes("\\") || name.split("/").includes("..");
  if (unsafe) throw new DomainError("invalid", NOT_XLSX);
}

/** Doğrulanmış girdilerden, tek EOCD'li, yorumsuz ve artık baytsız kanonik bir ZIP üretir. */
function rebuildZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const crc = crc32(data);
    const flags = name.some((b) => b > 0x7f) ? FLAG_UTF8 : 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_SIGNATURE, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(CENTRAL_SIGNATURE, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(20, 6);
    head.writeUInt16LE(flags, 8);
    head.writeUInt32LE(crc, 16);
    head.writeUInt32LE(data.length, 20);
    head.writeUInt32LE(data.length, 24);
    head.writeUInt16LE(name.length, 28);
    head.writeUInt32LE(offset, 42);
    locals.push(local, name, data);
    central.push(head, name);
    offset += 30 + name.length + data.length;
  }
  const directory = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIGNATURE, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, eocd]);
}

/**
 * Sıkıştırma bombası ve ayrıştırıcı farkı (parser differential) savunması: yüklenen bayt dizisi
 * ExcelJS'e HİÇ verilmez. Merkezi dizin sıkı biçimde doğrulanır (EOCD tam sonda, yorum/artık bayt yok,
 * dizin EOCD'ye bitişik, çok diskli/ZIP64/şifreli/yinelenen/güvensiz adlı girdi yok, veri bölgeleri çakışmaz),
 * her girdi kalan bütçe kadar açılır (GERÇEK boyut toplamı sınırlanır) ve doğrulanan girdilerle kanonik bir
 * ZIP yeniden kurulup döndürülür. Böylece doğrulanan ile açılan girdiler aynıdır.
 */
function canonicalizeZip(bytes: Uint8Array, maxBytes: number): Buffer {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  if (eocd < 0 || view.getUint32(eocd, true) !== EOCD_SIGNATURE) throw new DomainError("invalid", NOT_XLSX);
  // Yorum uzunluğu 0 olmalı; EOCD dosyanın son 22 baytı olduğundan artık bayt da olamaz.
  if (view.getUint16(eocd + 20, true) !== 0) throw new DomainError("invalid", NOT_XLSX);
  if (view.getUint16(eocd + 4, true) !== 0 || view.getUint16(eocd + 6, true) !== 0) {
    throw new DomainError("invalid", NOT_XLSX);
  }

  const entryCount = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (entryCount === 0xffff || directoryOffset === ZIP64_MARKER || directorySize === ZIP64_MARKER) {
    throw new DomainError("invalid", TOO_BIG);
  }
  if (entryCount > MAX_ZIP_ENTRIES) throw new DomainError("invalid", TOO_BIG);
  if (view.getUint16(eocd + 8, true) !== entryCount || directoryOffset + directorySize !== eocd) {
    throw new DomainError("invalid", NOT_XLSX);
  }

  let offset = directoryOffset;
  let declaredTotal = 0;
  let realTotal = 0;
  const names = new Set<string>();
  const regions: Array<[number, number]> = [];
  const entries: ZipEntry[] = [];
  for (let i = 0; i < entryCount; i += 1) {
    if (offset + 46 > eocd || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw new DomainError("invalid", NOT_XLSX);
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const declaredSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const diskStart = view.getUint16(offset + 34, true);
    const localOffset = view.getUint32(offset + 42, true);
    if (declaredSize === ZIP64_MARKER || compressedSize === ZIP64_MARKER || localOffset === ZIP64_MARKER) {
      throw new DomainError("invalid", TOO_BIG);
    }
    declaredTotal += declaredSize;
    if (declaredTotal > maxBytes) throw new DomainError("invalid", TOO_BIG);
    if (diskStart !== 0 || (flags & FLAG_ENCRYPTED) !== 0 || (method !== 0 && method !== 8)) {
      throw new DomainError("invalid", NOT_XLSX);
    }
    if (offset + 46 + nameLength + extraLength + commentLength > eocd || localOffset + 30 > directoryOffset) {
      throw new DomainError("invalid", NOT_XLSX);
    }
    if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) throw new DomainError("invalid", NOT_XLSX);

    const name = Buffer.from(bytes.subarray(offset + 46, offset + 46 + nameLength));
    const nameText = name.toString("utf8");
    assertSafeName(nameText);
    if (names.has(nameText)) throw new DomainError("invalid", NOT_XLSX);
    names.add(nameText);

    const localFlags = view.getUint16(localOffset + 6, true);
    const localMethod = view.getUint16(localOffset + 8, true);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    if ((localFlags & FLAG_ENCRYPTED) !== 0 || localMethod !== method || localNameLength !== nameLength) {
      throw new DomainError("invalid", NOT_XLSX);
    }
    if (localOffset + 30 + nameLength > directoryOffset || !sameBytes(bytes, offset + 46, localOffset + 30, nameLength)) {
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
    if (dataEnd > directoryOffset) throw new DomainError("invalid", NOT_XLSX);
    regions.push([localOffset, dataEnd]);
    const raw = bytes.subarray(dataStart, dataEnd);

    let data: Buffer;
    if (method === 0) {
      data = Buffer.from(raw);
    } else {
      try {
        data = zlib.inflateRawSync(raw, { maxOutputLength: Math.max(1, maxBytes - realTotal) });
      } catch (error) {
        const code = (error as { code?: string }).code;
        throw new DomainError("invalid", code === "ERR_BUFFER_TOO_LARGE" ? TOO_BIG : NOT_XLSX);
      }
    }
    realTotal += data.length;
    if (realTotal > maxBytes) throw new DomainError("invalid", TOO_BIG);
    if (data.length !== declaredSize) throw new DomainError("invalid", NOT_XLSX);
    entries.push({ name, data });

    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== eocd) throw new DomainError("invalid", NOT_XLSX);

  regions.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < regions.length; i += 1) {
    if ((regions[i]?.[0] ?? 0) < (regions[i - 1]?.[1] ?? 0)) throw new DomainError("invalid", NOT_XLSX);
  }
  return rebuildZip(entries);
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
  // ExcelJS yalnızca doğrulanmış girdilerden yeniden kurulan kanonik arşivi görür; yüklenen bayt dizisini değil.
  const canonical = canonicalizeZip(bytes, options.maxUncompressedBytes ?? MAX_UNCOMPRESSED_BYTES);

  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs'in eski `Buffer` tipi Node'un güncel tipiyle uyuşmuyor; çalışma zamanında aynı nesne.
    await workbook.xlsx.load(canonical as unknown as Parameters<typeof workbook.xlsx.load>[0]);
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
