import type { Ctx } from "./context";
import { isRecord } from "./context";

/**
 * Yeni şemada karşılığı olmayan (ya da kayıplı taşınan) eski veriler. Satır sayısı, o sütunu
 * dolu olan eski satır sayısıdır; 0 ise bu veritabanında kayıp yoktur. Yerleşime (venueLayout)
 * özgü boşluklar events.ts'te, satır satır taşınamayanlar ise rapor kategorilerinde listelenir.
 */
export function addSchemaGaps(ctx: Ctx): void {
  const L = ctx.legacy;
  const filled = (rows: typeof L.staff, key: string) => rows.filter((r) => r.raw[key] !== null && r.raw[key] !== undefined).length;
  const gap = (legacy: string, target: string, rows: number, note: string) => ctx.report.gap(legacy, target, rows, note);

  gap("staff.age", "nowhere", filled(L.staff, "age"), "yaş birth_date'ten türetilir; saklanan değer taşınmadı");
  gap("staff.isActive", "staff.status", L.staff.filter((r) => r.raw.isActive === false).length, "status'a katlandı (isActive=false → inactive)");
  gap("staff_performance_logs.*", "nowhere", L.staff_performance_logs.length, "hiçbir serviste kullanılmıyor; doluysa ayrıca arşivlenmeli");
  gap("migrations.*", "nowhere", L.migrations.length, "TypeORM migration kaydı");
  gap("system_settings.smtpPassword", "nowhere", filled(L.system_settings, "smtpPassword"), "parola iptal edildi; ayarlardan yeniden girilir (şifreli saklanır)");
  const members = L.service_teams.reduce((n, r) => {
    const list = r.json("members");
    return n + (Array.isArray(list) ? list.filter(isRecord).length : 0);
  }, 0);
  gap(
    "service_teams.members[].{fullName,email,color,position,avatar}",
    "nowhere",
    members,
    "üye anlık görüntüsü; yalnızca kimlik team_members.staff_id'ye taşınır, diğer alanlar personel kaydından okunur",
  );
  const leaders = L.service_teams.reduce((n, r) => {
    const list = r.json("leaders");
    return n + (Array.isArray(list) ? list.filter(isRecord).length : 0);
  }, 0);
  gap("service_teams.leaders[].staffName", "nowhere", leaders, "personel kaydından türetilir");
  gap("service_teams.createdAt (team_members)", "team_members.created_at", members, "üyelik tarihi bilinmiyor; ekibin tarihi kullanıldı");
  gap(
    "reservations.tableId (eski yerleşim masa kimliği metni)",
    "reservations.table_id (deterministik uuid)",
    L.reservations.length,
    "eski metin kimlik saklanmaz; eşleme raporun tableIdMap/placeholderTables kategorilerinde",
  );
  gap(
    "reservations.status (çakışan aktif kayıtlar)",
    "guest_notes.content",
    ctx.report.count("conflictingReservations"),
    "iptal edilen kopyanın eski durumu yalnızca bağlı nottaki metinde kalır",
  );
  gap(
    "event_staff_assignments/service_point_staff_assignments/staff_assignments (çakışan satırlar)",
    "nowhere",
    ctx.report.report.categories.assignmentConflicts.filter((f) => f.action === "atlandı").length,
    "yeni tekil (event, staff, shift) kısıtını ihlal eden ikinci atama taşınmadı",
  );
  gap(
    "staff_assignments.id / event_staff_assignments.id (birleştirilen masa atamaları)",
    "nowhere",
    ctx.report.report.categories.assignmentConflicts.filter((f) => f.action === "masalar birleştirildi").length,
    "masaları ilk atamaya eklendi; ikinci atamanın kimliği ve rengi kayboldu",
  );
  gap(
    "events.venueLayout.(placedTables|tables)[].type (eşleşmeyen)",
    "event_tables.table_type_id = NULL",
    ctx.report.report.categories.layoutIssues.filter((f) => f.kind === "table_type_unmatched").length,
    "table_types adıyla/kimliğiyle eşleşmeyen tür metni",
  );
  gap("timestamp(6) sütunları", "timestamptz (milisaniye)", 0, "mikrosaniye hanesi JS Date üzerinden geçtiği için milisaniyeye yuvarlanır (ölçülmedi)");
  for (const table of L.unknownTables) gap(`${table.name}.*`, "nowhere", table.rows, "eski veritabanında bilinmeyen tablo; taşınmadı");
}
