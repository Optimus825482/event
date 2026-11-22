import { parseCsv, type CsvParseResult } from "./csv";
import type { StaffStatus } from "./schemas";

/**
 * Personel CSV'si → taslak satırlar (saf; veritabanı yok). Sütunlar eski sistemin içe aktarımıyla
 * (backend `staff-crud.service.ts › importPersonnelFromCSV`) aynıdır. Katalog adları (bölüm, unvan,
 * görev yeri) burada metin kalır; kimliğe çevirme ve Zod doğrulaması `import-service.ts`tedir.
 */

export const STAFF_IMPORT_MAX_ROWS = 500;
export const STAFF_IMPORT_MAX_BYTES = 1024 * 1024;

export const IMPORT_FIELDS = [
  "sicilNo",
  "fullName",
  "email",
  "phone",
  "department",
  "position",
  "workLocation",
  "mentor",
  "gender",
  "bloodType",
  "shoeSize",
  "sockSize",
  "birthDate",
  "hireDate",
  "status",
  "terminationDate",
  "terminationReason",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Görünen ad (önizleme ve hata iletileri) + kabul edilen başlık adları. İlk ad eski sistemdekidir. */
export const FIELD_HEADERS: Record<ImportField, readonly string[]> = {
  sicilNo: ["Sicil No", "Sicil", "Sicil Numarası"],
  fullName: ["İsim Soyisim", "Ad Soyad", "Adı Soyadı"],
  email: ["E-posta", "Eposta", "Email", "E-mail"],
  phone: ["Telefon", "Tel"],
  department: ["Çalıştığı Bölüm", "Bölüm"],
  position: ["Unvan", "Ünvan"],
  workLocation: ["Görev Yeri"],
  mentor: ["Miçolar", "Mentor"],
  gender: ["Cinsiyet"],
  bloodType: ["Kan Grubu"],
  shoeSize: ["Ayakkabı Numarası"],
  sockSize: ["Kadın Çorap Bedenleri", "Çorap Bedeni"],
  birthDate: ["Doğum Tarihi"],
  hireDate: ["İşe Giriş Tarihi"],
  status: ["Durum"],
  terminationDate: ["Ayrılma Tarihi"],
  terminationReason: ["Ayrılma Nedeni"],
};

export const REQUIRED_FIELDS: readonly ImportField[] = ["sicilNo", "fullName"];

/** Türkçe duyarsız karşılaştırma anahtarı: NFC, boşlukları tek boşluğa indir, küçült, aksanları düz harfe çevir. */
export function foldKey(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/[ıîï]/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/[öô]/g, "o")
    .replace(/ş/g, "s")
    .replace(/[üû]/g, "u")
    .replace(/â/g, "a");
}

/** Başlık anahtarı: ayrıca sondaki açıklama parantezi atılır ("Doğum Tarihi (Ay-Gün-Yıl)"). */
function headerKey(header: string): string {
  return foldKey(header.replace(/\s*\([^)]*\)\s*$/, ""));
}

const HEADER_LOOKUP = new Map<string, ImportField>(
  IMPORT_FIELDS.flatMap((field) => FIELD_HEADERS[field].map((name) => [headerKey(name), field] as const)),
);

export function fieldLabel(field: ImportField): string {
  return FIELD_HEADERS[field][0] ?? field;
}

export type ColumnMap = {
  /** Sütun dizini → alan (`null`: içe aktarılmayan sütun). */
  byIndex: (ImportField | null)[];
  /** İçe aktarılmayan, adı olan sütunlar (bilgi olarak gösterilir; hiçbiri sessizce yok sayılmaz). */
  ignored: string[];
  missing: ImportField[];
  /** Aynı alana eşlenen birden çok sütun. */
  conflicts: string[];
};

export function mapColumns(headers: readonly string[]): ColumnMap {
  const byIndex: (ImportField | null)[] = [];
  const ignored: string[] = [];
  const conflicts: string[] = [];
  const used = new Set<ImportField>();
  for (const header of headers) {
    const field = header === "" ? undefined : HEADER_LOOKUP.get(headerKey(header));
    if (!field) {
      byIndex.push(null);
      if (header !== "") ignored.push(header);
      continue;
    }
    if (used.has(field)) conflicts.push(header);
    used.add(field);
    byIndex.push(field);
  }
  const missing = REQUIRED_FIELDS.filter((f) => !used.has(f));
  return { byIndex, ignored, missing, conflicts };
}

// ---- Değer dönüştürücüler ----

const TR_MONTHS: Record<string, number> = {
  ocak: 1,
  subat: 2,
  mart: 3,
  nisan: 4,
  mayis: 5,
  haziran: 6,
  temmuz: 7,
  agustos: 8,
  eylul: 9,
  ekim: 10,
  kasim: 11,
  aralik: 12,
};

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** İki haneli yıl: eski sistemle aynı kural (> 50 → 19xx, değilse 20xx). */
function fullYear(raw: string): number {
  const year = Number(raw);
  if (raw.length > 2) return year;
  return year > 50 ? 1900 + year : 2000 + year;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * Kabul edilen tarih biçimleri: `YYYY-AA-GG`, `GG.AA.YYYY` (Türkiye), `15 Ocak 1990` (eski sistem).
 * `03/04/1990` gibi eğik çizgili/tireli sayısal biçimler gün-ay sırası belirsiz olduğu için reddedilir.
 */
export function parseImportDate(raw: string): Parsed<string | null> {
  const value = raw.trim();
  if (value === "") return { ok: true, value: null };
  let parts: [number, number, number] | null = null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (iso) parts = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  if (!parts) {
    const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(value);
    if (dotted) parts = [fullYear(dotted[3] ?? ""), Number(dotted[2]), Number(dotted[1])];
  }
  if (!parts) {
    const named = /^(\d{1,2})\s+(\S+)\s+(\d{2}|\d{4})$/u.exec(value);
    const month = named ? TR_MONTHS[foldKey(named[2] ?? "")] : undefined;
    if (named && month) parts = [fullYear(named[3] ?? ""), month, Number(named[1])];
  }
  if (!parts) return { ok: false, message: `tarih anlaşılamadı (“${value}”); GG.AA.YYYY ya da YYYY-AA-GG kullanın` };
  const date = isoDate(...parts);
  return date ? { ok: true, value: date } : { ok: false, message: `geçersiz tarih (“${value}”)` };
}

export function parseGender(raw: string): Parsed<"male" | "female" | null> {
  const key = foldKey(raw);
  if (key === "") return { ok: true, value: null };
  if (["erkek", "e", "male", "m", "bay"].includes(key)) return { ok: true, value: "male" };
  if (["kadin", "k", "female", "f", "bayan"].includes(key)) return { ok: true, value: "female" };
  return { ok: false, message: `“${raw.trim()}” tanınmadı (Erkek / Kadın)` };
}

export function parseShoeSize(raw: string): Parsed<number | null> {
  const value = raw.trim();
  if (value === "") return { ok: true, value: null };
  if (!/^\d{1,3}$/.test(value)) return { ok: false, message: `tam sayı olmalı (“${value}”)` };
  return { ok: true, value: Number(value) };
}

/** Boş hücre: çalışıyor. Eski sistemin değerleri ve İngilizce karşılıkları kabul edilir. */
export function parseStatus(raw: string): Parsed<StaffStatus> {
  const key = foldKey(raw);
  if (key === "" || ["calisiyor", "aktif", "active"].includes(key)) return { ok: true, value: "active" };
  if (["pasif", "inactive"].includes(key)) return { ok: true, value: "inactive" };
  if (["ayrildi", "terminated"].includes(key)) return { ok: true, value: "terminated" };
  return { ok: false, message: `“${raw.trim()}” tanınmadı (Çalışıyor / Pasif / Ayrıldı)` };
}

// ---- Satır taslağı ----

export type StaffDraft = {
  sicilNo: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  workLocation: string;
  mentor: string;
  gender: "male" | "female" | null;
  bloodType: string;
  shoeSize: number | null;
  sockSize: string;
  birthDate: string | null;
  hireDate: string | null;
  status: StaffStatus;
  terminationDate: string | null;
  terminationReason: string;
};

export type DraftRow = { line: number; draft: StaffDraft; errors: string[] };

export type StaffCsv = {
  headers: string[];
  columns: ColumnMap;
  rows: DraftRow[];
  emptyRows: number;
};

function textCell(cells: Map<ImportField, string>, field: ImportField): string {
  return cells.get(field) ?? "";
}

function toDraft(line: number, values: readonly string[], columns: ColumnMap, headers: readonly string[]): DraftRow {
  const errors: string[] = [];
  const cells = new Map<ImportField, string>();
  values.forEach((value, index) => {
    const field = columns.byIndex[index];
    if (field) {
      cells.set(field, value);
      return;
    }
    // Adı olan ama içe aktarılmayan sütun önizlemede listelenir; başlıksız sütundaki veri ise hatadır.
    const named = (headers[index] ?? "") !== "";
    if (!named && value.trim() !== "") errors.push(`${index + 1}. sütunda başlıksız veri var`);
  });

  const take = <T,>(field: ImportField, parsed: Parsed<T>, fallback: T): T => {
    if (parsed.ok) return parsed.value;
    errors.push(`${fieldLabel(field)}: ${parsed.message}`);
    return fallback;
  };

  const draft: StaffDraft = {
    sicilNo: textCell(cells, "sicilNo"),
    fullName: textCell(cells, "fullName"),
    email: textCell(cells, "email"),
    phone: textCell(cells, "phone"),
    department: textCell(cells, "department"),
    position: textCell(cells, "position"),
    workLocation: textCell(cells, "workLocation"),
    mentor: textCell(cells, "mentor"),
    gender: take("gender", parseGender(textCell(cells, "gender")), null),
    bloodType: textCell(cells, "bloodType"),
    shoeSize: take("shoeSize", parseShoeSize(textCell(cells, "shoeSize")), null),
    sockSize: textCell(cells, "sockSize"),
    birthDate: take("birthDate", parseImportDate(textCell(cells, "birthDate")), null),
    hireDate: take("hireDate", parseImportDate(textCell(cells, "hireDate")), null),
    status: take("status", parseStatus(textCell(cells, "status")), "active"),
    terminationDate: take("terminationDate", parseImportDate(textCell(cells, "terminationDate")), null),
    terminationReason: textCell(cells, "terminationReason"),
  };
  return { line, draft, errors };
}

export class StaffCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffCsvError";
  }
}

/** CSV metnini taslak satırlara çevirir. Dosya düzeyindeki sorunlar (`CsvError` dahil) fırlatılır. */
export function readStaffCsv(text: string): StaffCsv {
  const parsed: CsvParseResult = parseCsv(text);
  const columns = mapColumns(parsed.headers);
  if (columns.missing.length > 0) {
    throw new StaffCsvError(`Zorunlu sütun eksik: ${columns.missing.map(fieldLabel).join(", ")}`);
  }
  if (columns.conflicts.length > 0) {
    throw new StaffCsvError(`Aynı alana birden çok sütun eşleniyor: ${columns.conflicts.join(", ")}`);
  }
  if (parsed.rows.length === 0) throw new StaffCsvError("Dosyada veri satırı yok");
  if (parsed.rows.length > STAFF_IMPORT_MAX_ROWS) {
    throw new StaffCsvError(`En fazla ${STAFF_IMPORT_MAX_ROWS} satır içe aktarılabilir (dosyada ${parsed.rows.length} var)`);
  }
  const rows = parsed.rows.map((record) => toDraft(record.line, record.cells, columns, parsed.headers));
  return { headers: parsed.headers, columns, rows, emptyRows: parsed.emptyRows };
}
