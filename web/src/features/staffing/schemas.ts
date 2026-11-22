import { z } from "zod";
import { MAX_ROLE_COUNT, MAX_ROLES_PER_POINT, normalizeRole, overrideTimesError } from "./service-point-roles";

/** Form alanları boş string gönderebilir; boş değer "yok" demektir. */
function emptyToNull(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

const id = z.uuid({ error: "Geçersiz kimlik" });
const optionalId = z.preprocess(emptyToNull, id.nullish());

const text = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, `En fazla ${max} karakter olabilir`).nullish());

const name = (label: string) =>
  z
    .string({ error: `${label} gerekli` })
    .trim()
    .min(1, `${label} gerekli`)
    .max(100, `${label} en fazla 100 karakter olabilir`);

const color = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Renk #RRGGBB biçiminde olmalı")
    .nullish(),
);

const time = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Saat SS:DD biçiminde olmalı")
    .nullish(),
);

const sortOrder = z.number().int().min(0).max(100_000).optional();

function uniqueBy<T>(items: T[], key: (item: T) => string | null | undefined): boolean {
  const seen = new Set<string>();
  for (const item of items) {
    const k = key(item);
    if (k === null || k === undefined) continue;
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

const idList = z
  .array(id)
  .max(2000)
  .default([])
  .refine((ids) => new Set(ids).size === ids.length, "Aynı kayıt iki kez seçilmiş");

const eventId = id;

// ---- Ekipler ----

export const teamMemberSchema = z.object({
  staffId: id,
  isLeader: z.boolean().optional(),
  role: text(100),
  shiftStart: time,
  shiftEnd: time,
});

export const teamInputSchema = z.object({
  id: id.optional(),
  name: name("Ekip adı"),
  color,
  leaderStaffId: optionalId,
  sortOrder,
  isActive: z.boolean().optional(),
  members: z
    .array(teamMemberSchema)
    .max(500)
    .default([])
    .refine((m) => uniqueBy(m, (x) => x.staffId), "Bir personel ekibe bir kez eklenebilir"),
});

const teamList = z
  .array(teamInputSchema)
  .max(200)
  .refine((t) => uniqueBy(t, (x) => x.id), "Aynı ekip iki kez gönderilmiş");

export const saveTeamsSchema = z.object({ eventId, teams: teamList });

// ---- Masa grupları ----

export const groupInputSchema = z.object({
  id: id.optional(),
  name: name("Grup adı"),
  color,
  teamId: optionalId,
  supervisorStaffId: optionalId,
  groupType: text(50),
  sortOrder,
  notes: text(1000),
  tableIds: idList,
});

const groupList = z
  .array(groupInputSchema)
  .max(500)
  .refine((g) => uniqueBy(g, (x) => x.id), "Aynı grup iki kez gönderilmiş");

export const saveTableGroupsSchema = z.object({ eventId, groups: groupList });

export const assignTeamToGroupSchema = z.object({ eventId, groupId: id, teamId: optionalId });

// ---- Atamalar ----

export const ASSIGNMENT_TYPES = ["table", "special_task", "service_point"] as const;
export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

export const assignmentInputSchema = z.object({
  id: id.optional(),
  staffId: id,
  shiftId: optionalId,
  teamId: optionalId,
  assignmentType: z.enum(ASSIGNMENT_TYPES).default("table"),
  servicePointId: optionalId,
  role: text(100),
  shiftStart: time,
  shiftEnd: time,
  specialTaskLocation: text(200),
  specialTaskStartTime: time,
  specialTaskEndTime: time,
  color,
  notes: text(1000),
  sortOrder,
  tableIds: idList,
}).superRefine((a, ctx) => {
  const error = overrideTimesError(a.shiftStart, a.shiftEnd);
  if (error) ctx.addIssue({ code: "custom", path: ["shiftStart"], message: error });
});

const assignmentList = z
  .array(assignmentInputSchema)
  .max(2000)
  .refine((a) => uniqueBy(a, (x) => x.id), "Aynı atama iki kez gönderilmiş");

export const saveAssignmentsSchema = z.object({
  eventId,
  /** Bu kayıtta yönetilen atama türleri; diğer türlerdeki satırlara dokunulmaz. */
  types: z.array(z.enum(ASSIGNMENT_TYPES)).min(1).optional(),
  assignments: assignmentList,
});

export const AUTO_ASSIGN_STRATEGIES = ["balanced", "zone", "random"] as const;
export type AutoAssignStrategy = (typeof AUTO_ASSIGN_STRATEGIES)[number];

export const autoAssignSchema = z.object({
  eventId,
  staffIds: z
    .array(id)
    .min(1, "En az bir personel seçilmeli")
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, "Aynı personel iki kez seçilmiş"),
  strategy: z.enum(AUTO_ASSIGN_STRATEGIES),
  seed: z.number().int().optional(),
  shiftId: optionalId,
});

// ---- Ekstra personel ----

export const extraStaffInputSchema = z.object({
  id: id.optional(),
  fullName: name("Ad soyad"),
  position: text(100),
  role: text(100),
  shiftStart: time,
  shiftEnd: time,
  color,
  notes: text(1000),
  sortOrder,
  isActive: z.boolean().optional(),
  tableIds: idList,
  groupIds: idList,
});

const extraStaffList = z
  .array(extraStaffInputSchema)
  .max(500)
  .refine((e) => uniqueBy(e, (x) => x.id), "Aynı kayıt iki kez gönderilmiş");

export const saveExtraStaffSchema = z.object({ eventId, extraStaff: extraStaffList });

// ---- Servis noktası rolleri ----

export const roleRequirementSchema = z.object({
  role: z
    .string({ error: "Rol gerekli" })
    .trim()
    .min(1, "Rol gerekli")
    .max(50, "Rol en fazla 50 karakter olabilir"),
  requiredCount: z
    .number()
    .int("Sayı tam sayı olmalı")
    .min(0, "Sayı negatif olamaz")
    .max(MAX_ROLE_COUNT, `Sayı en fazla ${MAX_ROLE_COUNT} olabilir`),
});

export const servicePointRolesInputSchema = z.object({
  servicePointId: id,
  roles: z
    .array(roleRequirementSchema)
    .max(MAX_ROLES_PER_POINT, `En fazla ${MAX_ROLES_PER_POINT} rol tanımlanabilir`)
    .refine((r) => uniqueBy(r, (x) => normalizeRole(x.role)), "Aynı rol iki kez eklenmiş"),
});

const servicePointRolesList = z
  .array(servicePointRolesInputSchema)
  .max(500)
  .refine((p) => uniqueBy(p, (x) => x.servicePointId), "Aynı servis noktası iki kez gönderilmiş");

// ---- Tüm organizasyon ----

export const saveOrganizationSchema = z.object({
  eventId,
  teams: teamList,
  groups: groupList,
  assignments: assignmentList,
  extraStaff: extraStaffList.default([]),
  /** Gönderilmezse servis noktası rollerine dokunulmaz; gönderilen noktaların rolleri bununla değişir. */
  servicePointRoles: servicePointRolesList.optional(),
});

// ---- Şablonlar ----

export const createTemplateSchema = z.object({
  eventId,
  name: name("Şablon adı"),
  description: text(1000),
});

export const applyTemplateSchema = z.object({ eventId, templateId: id });
export const deleteTemplateSchema = z.object({ id });

/** Servis girdileri (ayrıştırılmış biçim); servisler testlerden ve sunucu kodundan doğrudan çağrılır. */
export type TeamInput = z.infer<typeof teamInputSchema>;
export type SaveTeamsInput = { eventId: string; teams: TeamInput[] };
export type GroupInput = z.infer<typeof groupInputSchema>;
export type SaveTableGroupsInput = { eventId: string; groups: GroupInput[] };
export type AssignTeamToGroupInput = z.infer<typeof assignTeamToGroupSchema>;
export type AssignmentInput = z.infer<typeof assignmentInputSchema>;
export type SaveAssignmentsInput = { eventId: string; types?: AssignmentType[]; assignments: AssignmentInput[] };
export type AutoAssignInput = z.infer<typeof autoAssignSchema>;
export type ExtraStaffInput = z.infer<typeof extraStaffInputSchema>;
export type SaveExtraStaffInput = { eventId: string; extraStaff: ExtraStaffInput[] };
export type SaveOrganizationInput = {
  eventId: string;
  teams: TeamInput[];
  groups: GroupInput[];
  assignments: AssignmentInput[];
  extraStaff?: ExtraStaffInput[];
  servicePointRoles?: ServicePointRolesInput[];
};
export type ServicePointRolesInput = z.infer<typeof servicePointRolesInputSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;
export type DeleteTemplateInput = z.infer<typeof deleteTemplateSchema>;
