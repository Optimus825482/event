import { DomainError } from "@/lib/action";
import { pgErrorInfo } from "@/lib/pg-error";

export const STAFFING_MESSAGES = {
  tableInTwoGroups: "Bir masa yalnızca tek gruba ait olabilir",
  duplicateShift: "Aynı personel aynı vardiyaya iki kez atanamaz",
  tableNotInEvent: "Masa bu etkinlikte bulunamadı",
  groupNotInEvent: "Masa grubu bu etkinlikte bulunamadı",
  teamNotInEvent: "Ekip bu etkinlikte bulunamadı",
  servicePointNotInEvent: "Servis noktası bu etkinlikte bulunamadı",
  shiftNotInEvent: "Vardiya bu etkinlikte kullanılamaz",
  staffNotFound: "Personel bulunamadı",
  foreignRecord: "Kayıt başka bir etkinliğe ait",
  servicePointRequired: "Servis noktası ataması için servis noktası seçilmeli",
  teamTableMismatch: "Bir masa tek ekibe ait olabilir: atamanın ekibi masanın grubundaki ekiple aynı olmalı",
  tablesOnlyForTable: "Yalnızca masa ataması masa içerebilir",
  overrideTimesPaired: "Özel saatte başlangıç ve bitiş birlikte girilmeli",
  overrideTimesDistinct: "Özel saatte başlangıç ve bitiş aynı olamaz",
  duplicatePointRole: "Aynı rol iki kez eklenmiş",
  invalidPointRole: "Servis noktası rolü geçersiz (boş rol ya da sıfırdan küçük sayı)",
} as const;

// Sıra önemlidir: ilk eşleşen kural kazanır.
const UNIQUE_RULES: Array<[RegExp, string]> = [
  [/^table_group_tables_event_table_uq$/, STAFFING_MESSAGES.tableInTwoGroups],
  [/^event_staff_assignments_event_staff_shift_uq$/, STAFFING_MESSAGES.duplicateShift],
  [/^service_point_role_requirements_point_role_uq$/, STAFFING_MESSAGES.duplicatePointRole],
  [/_pkey$/, STAFFING_MESSAGES.foreignRecord],
];

const FOREIGN_KEY_RULES: Array<[RegExp, string]> = [
  [/_table_fk$/, STAFFING_MESSAGES.tableNotInEvent],
  [/_group_fk$/, STAFFING_MESSAGES.groupNotInEvent],
  [/_service_point_fk$/, STAFFING_MESSAGES.servicePointNotInEvent],
  [/_shift_id_/, STAFFING_MESSAGES.shiftNotInEvent],
  [/_team_id_/, STAFFING_MESSAGES.teamNotInEvent],
  [/staff_id_/, STAFFING_MESSAGES.staffNotFound],
];

const CHECK_RULES: Array<[RegExp, string]> = [
  [/^event_staff_assignments_shift_times_paired$/, STAFFING_MESSAGES.overrideTimesPaired],
  [/^event_staff_assignments_shift_times_distinct$/, STAFFING_MESSAGES.overrideTimesDistinct],
  [/^service_point_role_requirements_/, STAFFING_MESSAGES.invalidPointRole],
];

function match(rules: Array<[RegExp, string]>, constraint: string, fallback: string): string {
  return rules.find(([re]) => re.test(constraint))?.[1] ?? fallback;
}

/** Ekip organizasyonu yazmalarındaki kısıt hatalarını Türkçe `conflict`e çevirir; diğerlerini aynen döner. */
export function mapStaffingDbError(error: unknown): unknown {
  if (error instanceof DomainError) return error;
  const info = pgErrorInfo(error);
  if (!info) return error;
  switch (info.code) {
    case "23505":
      return new DomainError("conflict", match(UNIQUE_RULES, info.constraint, "Kayıt zaten mevcut"));
    case "23503":
      return new DomainError("conflict", match(FOREIGN_KEY_RULES, info.constraint, "İlişkili kayıt bulunamadı"));
    case "23514":
      return new DomainError("conflict", match(CHECK_RULES, info.constraint, STAFFING_MESSAGES.servicePointRequired));
    default:
      return error;
  }
}
