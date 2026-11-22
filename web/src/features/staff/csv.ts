/**
 * Saf CSV ayrıştırıcı (RFC 4180 + Excel'in Türkçe yerel ayarındaki `;` ayırıcı). Veritabanı ve DOM
 * bağımsızdır. İlke: hiçbir şey sessizce atılmaz — hücreler kırpılmaz, tırnak içi satır sonları korunur,
 * kapanmamış tırnak hata verir. Yalnızca tümüyle boş kayıtlar (boş satır, `;;;`) atlanır ve sayılır.
 */

export type CsvDelimiter = ";" | ",";

export type CsvRecord = {
  /** Kaydın başladığı fiziksel satır (1 tabanlı; başlık satırı 1'dir). */
  line: number;
  cells: string[];
};

export type CsvParseResult = {
  delimiter: CsvDelimiter;
  headers: string[];
  rows: CsvRecord[];
  /** Atlanan tümüyle boş veri kayıtlarının sayısı. */
  emptyRows: number;
};

export class CsvError extends Error {
  readonly line: number | null;

  constructor(message: string, line: number | null = null) {
    super(message);
    this.name = "CsvError";
    this.line = line;
  }
}

const BOM = "﻿";

/** Başlık satırında (tırnak dışında) en çok geçen ayırıcı; eşitlikte `;` (Türkçe Excel varsayılanı). */
export function detectDelimiter(text: string): CsvDelimiter {
  let semicolons = 0;
  let commas = 0;
  let quoted = false;
  let content = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) {
      // Baştaki boş satırlar atlanır; ilk dolu satırın sonunda durulur.
      if (content) break;
      continue;
    } else if (!quoted && ch === ";") semicolons += 1;
    else if (!quoted && ch === ",") commas += 1;
    if (ch.trim() !== "") content = true;
  }
  if (semicolons === 0 && commas === 0) return ",";
  return semicolons >= commas ? ";" : ",";
}

/** Tüm kayıtları (başlık dahil) okur. */
function tokenize(text: string, delimiter: CsvDelimiter): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = "";
  let line = 1;
  let recordLine = 1;
  let i = 0;
  let quoted = false;
  /** Hücre tırnakla başladı ve tırnak kapandı: ardından yalnızca ayırıcı ya da satır sonu gelebilir. */
  let closed = false;

  const endCell = () => {
    cells.push(cell);
    cell = "";
    closed = false;
  };
  const endRecord = () => {
    endCell();
    records.push({ line: recordLine, cells });
    cells = [];
  };

  while (i < text.length) {
    const ch = text[i] ?? "";
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        closed = true;
        i += 1;
        continue;
      }
      if (ch === "\n" || (ch === "\r" && text[i + 1] !== "\n")) line += 1;
      cell += ch;
      i += 1;
      continue;
    }

    if (ch === delimiter) {
      endCell();
      i += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      endRecord();
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
      line += 1;
      recordLine = line;
      continue;
    }
    if (closed) {
      throw new CsvError(`Satır ${line}: kapanan tırnaktan sonra ayırıcı bekleniyordu`, line);
    }
    if (ch === '"' && cell === "") {
      quoted = true;
      i += 1;
      continue;
    }
    // Tırnaksız hücre içindeki tırnak olduğu gibi korunur (veri kaybı yok).
    cell += ch;
    i += 1;
  }

  if (quoted) throw new CsvError(`Satır ${recordLine}: kapanmamış tırnak`, recordLine);
  // Dosya sonundaki satır sonu boş bir kayıt üretmez.
  if (cell !== "" || cells.length > 0 || closed) endRecord();
  return records;
}

function isBlank(record: CsvRecord): boolean {
  return record.cells.every((c) => c.trim() === "");
}

/**
 * Metni başlık + veri kayıtlarına ayırır. Başlık yoksa ya da başlıkta yinelenen sütun adı varsa
 * `CsvError` fırlatır. Başlık adları yalnızca baş/son boşluktan arındırılır; adsız sütun `""` olur.
 */
export function parseCsv(input: string): CsvParseResult {
  const text = input.startsWith(BOM) ? input.slice(BOM.length) : input;
  const delimiter = detectDelimiter(text);
  const records = tokenize(text, delimiter);

  const headerIndex = records.findIndex((r) => !isBlank(r));
  const headerRecord = records[headerIndex];
  if (!headerRecord) throw new CsvError("Dosya boş: başlık satırı bulunamadı");

  const headers = headerRecord.cells.map((h) => h.trim());
  const seen = new Set<string>();
  headers.forEach((header) => {
    // Adsız sütunlara (Excel'in sondaki boş sütunları) izin verilir; içlerinde veri olup olmadığını eşleyici denetler.
    if (header === "") return;
    const key = header.toLocaleLowerCase("tr");
    if (seen.has(key)) throw new CsvError(`Başlıkta yinelenen sütun: ${header}`, headerRecord.line);
    seen.add(key);
  });

  const rows: CsvRecord[] = [];
  let emptyRows = 0;
  for (const record of records.slice(headerIndex + 1)) {
    if (isBlank(record)) emptyRows += 1;
    else rows.push(record);
  }
  return { delimiter, headers, rows, emptyRows };
}
