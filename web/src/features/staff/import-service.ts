import { eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import type { Db, Tx } from "@/db/client";
import { departments, positions, staff, workLocations } from "@/db/schema";
import { can } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { CsvError } from "./csv";
import {
  fieldLabel,
  foldKey,
  readStaffCsv,
  STAFF_IMPORT_MAX_BYTES,
  StaffCsvError,
  type DraftRow,
  type ImportField,
} from "./csv-import";
import { ensureStaffAccess } from "./pg-errors";
import { setStaffStatusSchema, staffInputSchema, type StaffInput, type StaffStatus } from "./schemas";
import { createStaff, setStaffStatus } from "./service";

export type StaffImportRowStatus = "ok" | "error" | "duplicate" | "created";

export type StaffImportRow = {
  line: number;
  sicilNo: string;
  fullName: string;
  status: StaffImportRowStatus;
  messages: string[];
};

export type StaffImportPreview = {
  rows: StaffImportRow[];
  okCount: number;
  errorCount: number;
  duplicateCount: number;
  /** Tanınmayan ya da içe aktarılmayan sütunlar (ör. "Yaş"): bilgi olarak gösterilir. */
  ignoredColumns: string[];
  emptyRows: number;
};

export type StaffImportResult = StaffImportPreview & { createdCount: number };

type StatusChange = { status: StaffStatus; terminationDate: string | null; terminationReason: string | null };
type Planned = { row: StaffImportRow; input: StaffInput | null; statusChange: StatusChange | null };

const statusFields = setStaffStatusSchema.omit({ id: true });

/** Zod alan yolu → CSV sütunu (hata iletisinde kullanıcının gördüğü başlık). */
const PATH_FIELD: Record<string, ImportField> = {
  departmentId: "department",
  positionId: "position",
  workLocationId: "workLocation",
};

/** Katı UTF-8: bozuk bayt dizisi `�` ile sessizce değiştirilmez, dosya reddedilir. */
export function decodeCsv(bytes: Uint8Array): string {
  if (bytes.byteLength > STAFF_IMPORT_MAX_BYTES) {
    throw new DomainError("invalid", `Dosya ${STAFF_IMPORT_MAX_BYTES / (1024 * 1024)} MB sınırını aşıyor`);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new DomainError("invalid", "Dosya UTF-8 kodlamalı olmalı (Excel: “CSV UTF-8” olarak kaydedin)");
  }
}

function readCsvOrFail(text: string) {
  try {
    return readStaffCsv(text);
  } catch (error) {
    if (error instanceof CsvError || error instanceof StaffCsvError) throw new DomainError("invalid", error.message);
    throw error;
  }
}

type CatalogIndex = Map<string, string[]>;

async function catalogIndex(db: Db | Tx, table: typeof departments | typeof positions | typeof workLocations) {
  const rows = await db.select({ id: table.id, name: table.name }).from(table).where(eq(table.isActive, true));
  const index: CatalogIndex = new Map();
  for (const row of rows) {
    const key = foldKey(row.name);
    index.set(key, [...(index.get(key) ?? []), row.id]);
  }
  return index;
}

function resolve(index: CatalogIndex, field: ImportField, raw: string, messages: string[]): string | null {
  const name = raw.trim();
  if (name === "") return null;
  const ids = index.get(foldKey(name)) ?? [];
  if (ids.length === 1) return ids[0] ?? null;
  messages.push(
    ids.length === 0
      ? `${fieldLabel(field)}: “${name}” bulunamadı (Kuruluş ayarlarında etkin kayıt olmalı)`
      : `${fieldLabel(field)}: “${name}” birden çok kayıtla eşleşiyor`,
  );
  return null;
}

function zodMessages(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const key = String(issue.path[0] ?? "");
    const field = PATH_FIELD[key] ?? (key as ImportField);
    return `${fieldLabel(field)}: ${issue.message}`;
  });
}

/** Önizleme ve içe aktarmanın ortak planı: her satır tek bir duruma (ok/error/duplicate) düşer. */
async function plan(db: Db | Tx, actor: Actor, text: string): Promise<{ planned: Planned[]; preview: StaffImportPreview }> {
  const csv = readCsvOrFail(text);
  // Sıralı: işlem (`tx`) tek bağlantıdır, eşzamanlı sorgu gönderilmez.
  const deps = await catalogIndex(db, departments);
  const poss = await catalogIndex(db, positions);
  const locs = await catalogIndex(db, workLocations);
  const sicils = [...new Set(csv.rows.map((r) => r.draft.sicilNo.trim()).filter((s) => s !== ""))];
  const existing = new Set(
    sicils.length === 0
      ? []
      : (await db.select({ sicilNo: staff.sicilNo }).from(staff).where(inArray(staff.sicilNo, sicils))).map((r) => r.sicilNo),
  );
  const canEdit = can(actor, "staff", "edit");
  const firstLine = new Map<string, number>();

  const planned = csv.rows.map((row: DraftRow): Planned => {
    const { draft } = row;
    const messages = [...row.errors];
    const candidate = {
      sicilNo: draft.sicilNo,
      fullName: draft.fullName,
      email: draft.email,
      phone: draft.phone,
      departmentId: resolve(deps, "department", draft.department, messages),
      positionId: resolve(poss, "position", draft.position, messages),
      workLocationId: resolve(locs, "workLocation", draft.workLocation, messages),
      mentor: draft.mentor,
      gender: draft.gender,
      birthDate: draft.birthDate,
      bloodType: draft.bloodType,
      shoeSize: draft.shoeSize,
      sockSize: draft.sockSize,
      hireDate: draft.hireDate,
    };
    const parsed = staffInputSchema.safeParse(candidate);
    if (!parsed.success) messages.push(...zodMessages(parsed.error));

    let statusChange: StatusChange | null = null;
    const terminationGiven = draft.terminationDate !== null || draft.terminationReason.trim() !== "";
    if (draft.status !== "terminated" && terminationGiven) {
      messages.push(`${fieldLabel("terminationDate")}: yalnızca “Ayrıldı” durumunda verilebilir`);
    } else if (draft.status !== "active") {
      const status = statusFields.safeParse({
        status: draft.status,
        terminationDate: draft.terminationDate,
        terminationReason: draft.terminationReason,
      });
      if (!status.success) messages.push(...zodMessages(status.error));
      else statusChange = status.data;
      if (!canEdit) messages.push(`${fieldLabel("status")}: pasif/ayrıldı durumu için personel düzenleme yetkisi gerekir`);
    }

    const base = { line: row.line, sicilNo: draft.sicilNo.trim(), fullName: draft.fullName.trim() };
    if (messages.length > 0 || !parsed.success) {
      return { row: { ...base, status: "error", messages }, input: null, statusChange: null };
    }
    const key = parsed.data.sicilNo;
    if (existing.has(key)) {
      return { row: { ...base, status: "duplicate", messages: ["Bu sicil numarası zaten kayıtlı; atlanacak"] }, input: null, statusChange: null };
    }
    const earlier = firstLine.get(key);
    if (earlier !== undefined) {
      return {
        row: { ...base, status: "duplicate", messages: [`Sicil numarası ${earlier}. satırda da var; atlanacak`] },
        input: null,
        statusChange: null,
      };
    }
    firstLine.set(key, row.line);
    return { row: { ...base, status: "ok", messages: [] }, input: parsed.data, statusChange };
  });

  const rows = planned.map((p) => p.row);
  const countOf = (status: StaffImportRowStatus) => rows.filter((r) => r.status === status).length;
  return {
    planned,
    preview: {
      rows,
      okCount: countOf("ok"),
      errorCount: countOf("error"),
      duplicateCount: countOf("duplicate"),
      ignoredColumns: csv.columns.ignored,
      emptyRows: csv.emptyRows,
    },
  };
}

/** Yazmadan önizler: satır başına doğrulama hataları ve yinelenen sicil numaraları. */
export async function previewStaffImport(
  db: Db | Tx,
  actor: Actor,
  input: { bytes: Uint8Array },
): Promise<StaffImportPreview> {
  ensureStaffAccess(actor, "create");
  return (await plan(db, actor, decodeCsv(input.bytes))).preview;
}

/**
 * Geçerli satırları tek işlemde `createStaff` ile ekler (renk, tekillik ve yabancı anahtar kuralları
 * aynıdır); durumu pasif/ayrıldı olanlara `setStaffStatus` uygulanır. Hatalı ve yinelenen satırlar
 * atlanır ve raporlanır. Eşzamanlı bir ekleme tekillik çakışması doğurursa tüm işlem geri alınır.
 */
export async function importStaffCsv(
  db: Db | Tx,
  actor: Actor,
  input: { bytes: Uint8Array },
): Promise<StaffImportResult> {
  ensureStaffAccess(actor, "create");
  const text = decodeCsv(input.bytes);
  return db.transaction(async (tx) => {
    const { planned, preview } = await plan(tx, actor, text);
    let createdCount = 0;
    const rows: StaffImportRow[] = [];
    for (const item of planned) {
      if (!item.input) {
        rows.push(item.row);
        continue;
      }
      const { id } = await createStaff(tx, actor, item.input);
      if (item.statusChange) await setStaffStatus(tx, actor, { id, ...item.statusChange });
      createdCount += 1;
      rows.push({ ...item.row, status: "created" });
    }
    return { ...preview, rows, createdCount };
  });
}
