import type { LegacyData } from "./legacy";
import type { CategoryKey, Finding, ReportBuilder } from "./report";
import type { Writer } from "./target";
import { asUuid } from "./values";

/** Etkinlik başına masa dizini: eski yerleşim kimliği / etiket → yeni `event_tables.id`. */
export type EventTableIndex = {
  byLegacyId: Map<string, string>;
  byLabel: Map<string, string>;
  takenLabels: Set<string>;
  ids: Set<string>;
};

export type MigrationOptions = {
  /** Organizatörü olmayan etkinliklere atanacak kullanıcı (eski kullanıcı kimliği). */
  defaultOrganizerId?: string;
  /** Rezervasyon QR belirteci üretimi (bkz. qr.ts). */
  makeQrToken: (reservationId: string) => string;
};

export class Ctx {
  readonly userIds = new Set<string>();
  readonly staffIds = new Set<string>();
  /** Eski kullanıcı kimliği → personel kimliği (eşleşen ya da oluşturulan). */
  readonly userToStaff = new Map<string, string>();
  readonly eventIds = new Set<string>();
  readonly tables = new Map<string, EventTableIndex>();
  /** Eski müşteri kimliği → hayatta kalan müşteri kimliği (birleştirme sonrası). */
  readonly customerAlias = new Map<string, string>();
  readonly teamIds = new Set<string>();
  /** Masa grubu kimliği → etkinlik kimliği. */
  readonly tableGroups = new Map<string, string>();
  readonly shiftIds = new Set<string>();
  readonly reservationIds = new Set<string>();
  readonly tableTypeIds = new Set<string>();

  constructor(
    readonly legacy: LegacyData,
    readonly w: Writer,
    readonly report: ReportBuilder,
    readonly options: MigrationOptions,
  ) {}

  add(category: CategoryKey, finding: Finding): void {
    this.report.add(category, finding);
  }

  tableIndex(eventId: string): EventTableIndex {
    let index = this.tables.get(eventId);
    if (!index) {
      index = { byLegacyId: new Map(), byLabel: new Map(), takenLabels: new Set(), ids: new Set() };
      this.tables.set(eventId, index);
    }
    return index;
  }

  /** Eski masa referansı (yerleşim kimliği) → yeni masa kimliği; yoksa NULL. */
  resolveTable(eventId: string, ref: string): string | null {
    return this.tables.get(eventId)?.byLegacyId.get(ref) ?? null;
  }

  /**
   * Eski personel referansı → `staff.id`. Eski sistemde bazı tablolar personel kaydını
   * (`staff.id`), bazıları kullanıcıyı (`users.id`) gösterir; önce personel, sonra kullanıcı eşlemesi denenir.
   */
  resolveStaff(ref: string | null): string | null {
    const id = asUuid(ref);
    if (id === null) return null;
    if (this.staffIds.has(id)) return id;
    return this.userToStaff.get(id) ?? null;
  }

  resolveUser(ref: string | null): string | null {
    const id = asUuid(ref);
    return id !== null && this.userIds.has(id) ? id : null;
  }

  resolveEvent(ref: string | null): string | null {
    const id = asUuid(ref);
    return id !== null && this.eventIds.has(id) ? id : null;
  }
}

/** JSON değerinden metin dizisi (eski `jsonb` dizileri: kimlikler, güçlü yönler…). */
export function jsonStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (typeof v === "string") return [v];
    if (typeof v === "number" || typeof v === "boolean") return [String(v)];
    if (v !== null && typeof v === "object") return [JSON.stringify(v)];
    return [];
  });
}

/** JSON nesnesi mi (dizi değil). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
