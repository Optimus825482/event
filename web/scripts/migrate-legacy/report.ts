/**
 * Taşıma raporu: tablo başına kaynak/hedef sayıları, bulgu kategorileri, şema boşlukları ve
 * doğrulama sonuçları. Rapor yalnızca kimlik, etiket ve sayı içerir; telefon ve e-posta
 * değerleri hiçbir kategoriye yazılmaz (bulgu üreten modüllerin sözleşmesi).
 */

export const CATEGORIES = {
  // Görev tanımındaki (brief) kategoriler
  orphanTableReferences: "Yetim masa referansları (yerleşimde olmayan masa kimliği/etiketi)",
  unmatchedStaff: "Eşleşmeyen personel (personel kaydıyla eşleşmeyen kullanıcılar; personel kaydı oluşturuldu)",
  unresolvedStaffReferences: "Çözülemeyen personel referansları (bağlantı taşınmadı)",
  conflictingReservations: "Çakışan rezervasyonlar (aynı masada birden çok aktif; en eskisi aktif kaldı)",
  caseOnlyUsernames: "Yalnızca harf büyüklüğüyle ayrışan kullanıcı adları",
  eventsWithoutOrganizer: "Organizatörsüz etkinlikler (varsayılan organizatör atandı)",
  // Ek kategoriler
  placeholderTables: "Yer tutucu masalar (yetim referanslı rezervasyonlar için oluşturuldu)",
  tablesResolvedByLabel: "Masa kimliği yerine etiket/numara ile eşlenen rezervasyonlar",
  userStaffLinks: "Kullanıcı ↔ personel eşleşmeleri",
  customerMerges: "Birleştirilen müşteriler (normalize telefon/e-posta aynı)",
  customersFromGuest: "Misafir bilgisinden oluşturulan/eşlenen müşteriler",
  placeholderCustomers: "Yer tutucu müşteriler (misafiri tanımlayan bilgi yok)",
  unnormalizableContacts: "Normalize edilemeyen telefon/e-posta (ham değer korundu, normalize sütun NULL)",
  userIdentityFixes: "Kullanıcı adı/e-posta düzeltmeleri (boş, geçersiz ya da çakışan)",
  nonBcryptPasswords: "bcrypt biçiminde olmayan parola özetleri (giriş çalışmayabilir)",
  duplicateLabels: "Yeniden adlandırılan masa etiketleri (etkinlikte çakışan)",
  duplicateShiftNames: "Yeniden adlandırılan vardiyalar (kapsamda aynı ad)",
  tableGroupConflicts: "Birden çok gruba ait masalar (ilk grup korundu)",
  assignmentConflicts: "Personel ataması çakışmaları (etkinlik + personel + vardiya)",
  reviewConflicts: "Değerlendirme çakışmaları (personel + etkinlik + değerlendiren)",
  orphanReferences: "Yetim referanslar (hedefi olmayan kimlik; NULL yapıldı ya da satır atlandı)",
  invalidValues: "Düzeltilen geçersiz değerler",
  layoutIssues: "Yerleşim (venueLayout) dönüşüm notları",
  skippedRows: "Taşınmayan satırlar",
  catalogEntriesCreated: "Serbest metinden oluşturulan katalog kayıtları",
  tableIdMap: "Eski yerleşim masa kimliği → yeni event_tables.id eşlemesi",
  information: "Bilgi",
} as const;

export type CategoryKey = keyof typeof CATEGORIES;
export type FindingValue = string | number | boolean | null | readonly string[];
export type Finding = Readonly<Record<string, FindingValue>>;

export type TableCount = { legacyTable: string; source: number; targetTable: string; target: number };
export type SchemaGap = { legacy: string; target: string; rows: number; note: string };
export type VerificationResult = { name: string; ok: boolean; detail: string };

export type MigrationReport = {
  startedAt: string;
  finishedAt: string | null;
  mode: "dry-run" | "commit";
  outcome: "committed" | "rolled-back" | "failed";
  error: string | null;
  legacyTimeZone: string;
  sourceCounts: Record<string, number>;
  targetCounts: Record<string, number>;
  tables: TableCount[];
  categories: Record<CategoryKey, Finding[]>;
  schemaGaps: SchemaGap[];
  verification: VerificationResult[];
};

function emptyCategories(): Record<CategoryKey, Finding[]> {
  const out = {} as Record<CategoryKey, Finding[]>;
  for (const key of Object.keys(CATEGORIES) as CategoryKey[]) out[key] = [];
  return out;
}

export class ReportBuilder {
  readonly report: MigrationReport;

  constructor(mode: MigrationReport["mode"], legacyTimeZone: string) {
    this.report = {
      startedAt: new Date().toISOString(),
      finishedAt: null,
      mode,
      outcome: "failed",
      error: null,
      legacyTimeZone,
      sourceCounts: {},
      targetCounts: {},
      tables: [],
      categories: emptyCategories(),
      schemaGaps: [],
      verification: [],
    };
  }

  add(category: CategoryKey, finding: Finding): void {
    this.report.categories[category].push(finding);
  }

  gap(legacy: string, target: string, rows: number, note: string): void {
    this.report.schemaGaps.push({ legacy, target, rows, note });
  }

  count(category: CategoryKey): number {
    return this.report.categories[category].length;
  }
}

/** Eski tablo → hedef tablo eşleşmesi (sayım tablosu için; birden çok hedef olabilir). */
export const TABLE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["users", "users"],
  ["users", "accounts"],
  ["staff", "staff"],
  ["departments", "departments"],
  ["positions", "positions"],
  ["work_locations", "work_locations"],
  ["department_positions", "department_positions"],
  ["department_locations", "department_locations"],
  ["staff_roles", "staff_roles"],
  ["table_types", "table_types"],
  ["staff_colors", "staff_colors"],
  ["system_settings", "system_settings"],
  ["user_permissions", "user_permissions"],
  ["venue_templates", "venue_templates"],
  ["events", "events"],
  ["events", "event_tables"],
  ["service_points", "service_points"],
  ["work_shifts", "work_shifts"],
  ["customers", "customers"],
  ["customers", "customer_tags"],
  ["reservations", "reservations"],
  ["guest_notes", "guest_notes"],
  ["teams", "teams"],
  ["service_teams", "teams"],
  ["teams", "team_members"],
  ["service_teams", "team_members"],
  ["table_groups", "table_groups"],
  ["table_groups", "table_group_tables"],
  ["event_staff_assignments", "event_staff_assignments"],
  ["service_point_staff_assignments", "event_staff_assignments"],
  ["staff_assignments", "event_staff_assignments"],
  ["event_staff_assignments", "assignment_tables"],
  ["event_extra_staff", "event_extra_staff"],
  ["event_extra_staff", "event_extra_staff_tables"],
  ["event_extra_staff", "event_extra_staff_groups"],
  ["organization_templates", "organization_templates"],
  ["invitation_templates", "invitation_templates"],
  ["event_invitations", "event_invitations"],
  ["notifications", "notifications"],
  ["notification_reads", "notification_reads"],
  ["staff_performance_reviews", "staff_performance_reviews"],
  ["staff_performance_logs", "(taşınmaz)"],
  ["migrations", "(taşınmaz)"],
];

export function finalizeTables(report: MigrationReport): void {
  report.tables = TABLE_PAIRS.map(([legacyTable, targetTable]) => ({
    legacyTable,
    source: report.sourceCounts[legacyTable] ?? 0,
    targetTable,
    target: report.targetCounts[targetTable] ?? 0,
  }));
}

function formatValue(value: FindingValue): string {
  if (Array.isArray(value)) return `[${value.join(", ")}]`;
  return value === null ? "NULL" : String(value);
}

/** İnsan okunur ayrıntılı rapor (dosyaya yazılır; kimlik ve etiket içerir, kişisel iletişim verisi içermez). */
export function renderText(report: MigrationReport): string {
  const lines: string[] = [];
  lines.push("EventFlow eski veri taşıma raporu");
  lines.push(`Mod: ${report.mode}  Sonuç: ${report.outcome}  Eski saat dilimi: ${report.legacyTimeZone}`);
  lines.push(`Başlangıç: ${report.startedAt}  Bitiş: ${report.finishedAt ?? "-"}`);
  if (report.error) lines.push(`HATA: ${report.error}`);
  lines.push("", "== Tablolar (eski kaynak → yeni hedef) ==");
  for (const t of report.tables) {
    lines.push(`${t.legacyTable.padEnd(34)} ${String(t.source).padStart(7)}  →  ${t.targetTable.padEnd(28)} ${String(t.target).padStart(7)}`);
  }
  lines.push("", "== Bulgular ==");
  for (const key of Object.keys(CATEGORIES) as CategoryKey[]) {
    const items = report.categories[key];
    lines.push(`-- ${CATEGORIES[key]} [${key}]: ${items.length}`);
    for (const item of items) {
      lines.push(`   • ${Object.entries(item).map(([k, v]) => `${k}=${formatValue(v)}`).join("  ")}`);
    }
  }
  lines.push("", "== Şema boşlukları (eski sütun → yeni şemada karşılığı) ==");
  for (const g of report.schemaGaps) {
    lines.push(`- ${g.legacy} → ${g.target} (dolu satır: ${g.rows}): ${g.note}`);
  }
  lines.push("", "== Doğrulama ==");
  for (const v of report.verification) lines.push(`${v.ok ? "OK  " : "FAIL"} ${v.name}: ${v.detail}`);
  return `${lines.join("\n")}\n`;
}

/** Konsol özeti: yalnızca sayılar (kişisel veri ya da etiket yok). */
export function renderSummary(report: MigrationReport): string {
  const lines = [`Taşıma (${report.mode}) sonucu: ${report.outcome}`];
  if (report.error) lines.push(`Hata: ${report.error}`);
  const nonEmpty = (Object.keys(CATEGORIES) as CategoryKey[]).filter((k) => report.categories[k].length > 0);
  lines.push(`Tablolar: ${report.tables.map((t) => `${t.targetTable}=${t.target}`).filter((s, i, a) => a.indexOf(s) === i).join(" ")}`);
  lines.push(`Bulgular: ${nonEmpty.map((k) => `${k}=${report.categories[k].length}`).join(" ") || "yok"}`);
  lines.push(`Şema boşlukları: ${report.schemaGaps.filter((g) => g.rows > 0).length} dolu / ${report.schemaGaps.length} toplam`);
  const failed = report.verification.filter((v) => !v.ok);
  lines.push(`Doğrulama: ${report.verification.length - failed.length}/${report.verification.length} geçti`);
  return lines.join("\n");
}
