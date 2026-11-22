import { z } from "zod";
import { ASSIGNMENT_TYPES } from "./schemas";

/**
 * Şablon anlık görüntüsü (JSONB). Personel `staff.id` ile tutulur ve uygulamada yalnızca
 * kimlikle eşlenir (ad ile değil). Masalar kimlik + etiketle tutulur: aynı etkinlikte kimlik,
 * başka etkinlikte etiket (etkinlik içinde tekil) eşleşir; eşleşmeyen masa raporlanır.
 */
const tableRef = z.object({ id: z.string(), label: z.string() });

const nullableText = z.string().nullish();

export const templateTeamSchema = z.object({
  key: z.string(),
  name: z.string().min(1),
  color: z.string(),
  sortOrder: z.number().int().default(0),
  leaderStaffId: z.string().nullish(),
  members: z
    .array(
      z.object({
        staffId: z.string(),
        isLeader: z.boolean().default(false),
        role: nullableText,
        shiftStart: nullableText,
        shiftEnd: nullableText,
      }),
    )
    .default([]),
});

export const templateGroupSchema = z.object({
  name: z.string().min(1),
  color: z.string(),
  groupType: z.string().default("standard"),
  sortOrder: z.number().int().default(0),
  notes: nullableText,
  teamKey: z.string().nullish(),
  supervisorStaffId: z.string().nullish(),
  tables: z.array(tableRef).default([]),
});

export const templateAssignmentSchema = z.object({
  staffId: z.string(),
  shiftId: z.string().nullish(),
  teamKey: z.string().nullish(),
  assignmentType: z.enum(ASSIGNMENT_TYPES).default("table"),
  servicePointName: z.string().nullish(),
  role: nullableText,
  shiftStart: nullableText,
  shiftEnd: nullableText,
  specialTaskLocation: nullableText,
  specialTaskStartTime: nullableText,
  specialTaskEndTime: nullableText,
  color: nullableText,
  notes: nullableText,
  sortOrder: z.number().int().default(0),
  tables: z.array(tableRef).default([]),
});

export const templateSnapshotSchema = z.object({
  teams: z.array(templateTeamSchema),
  groups: z.array(templateGroupSchema),
  assignments: z.array(templateAssignmentSchema),
});

export type TemplateSnapshot = z.infer<typeof templateSnapshotSchema>;
export type TableRef = z.infer<typeof tableRef>;
