"use client";

import { createContext, useContext } from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import type { Organization } from "../organization-service";
import { planAutoAssign } from "../auto-assign";
import { assignTablesToGroup, clearGroupTables } from "../group-plan";
import { addGroupStaff, addServicePointStaff, removeGroupStaff, type StaffPick } from "../group-staff";
import { emptyHistory, isDirty, record, redo as redoHistory, undo as undoHistory, type History } from "../history";
import type { AutoAssignStrategy } from "../schemas";

export type DraftTeam = Organization["teams"][number];
export type DraftGroup = Organization["groups"][number];
export type DraftAssignment = Organization["assignments"][number];
export type DraftExtra = Organization["extraStaff"][number];
export type DraftPointRoles = Organization["servicePointRoles"][number];

export const WIZARD_STEPS = [
  { id: "groups", title: "Masa Grupları", description: "Masaları gruplara ayırın" },
  { id: "loca", title: "Localar", description: "Loca grupları ve personeli" },
  { id: "teams", title: "Ekipler", description: "Ekipleri kurun ve gruplara bağlayın" },
  { id: "assignments", title: "Personel Atama", description: "Masa, özel görev ve servis noktası" },
  { id: "extra", title: "Ekstra Personel", description: "Kadro dışı geçici personel" },
  { id: "summary", title: "Özet ve Kaydet", description: "Kontrol edin, kaydedin, şablon" },
] as const;
export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#84cc16"];
const pickColor = (n: number) => COLORS[n % COLORS.length] ?? "#3b82f6";

export type Draft = {
  teams: DraftTeam[];
  groups: DraftGroup[];
  assignments: DraftAssignment[];
  extraStaff: DraftExtra[];
  /** Servis noktası başına izinli roller ve rol başına gereken sayı. */
  servicePointRoles: DraftPointRoles[];
};

export type OrganizationState = Draft & {
  reference: Pick<Organization, "tables" | "staff" | "shifts" | "servicePoints" | "reviewHints">;
  step: WizardStepId;
  dirty: boolean;
  /** Taslak değişikliklerinin geri al / yinele geçmişi (adım ve referans veri dahil değil). */
  history: History<Draft>;
  undo: () => void;
  redo: () => void;
  setStep: (step: WizardStepId) => void;
  reset: (org: Organization) => void;
  addGroup: () => void;
  updateGroup: (id: string, patch: Partial<DraftGroup>) => void;
  removeGroup: (id: string) => void;
  /** Masayı gruba ekler (önceki grubundan çıkarır) ya da gruptaysa çıkarır: bir masa tek grupta. */
  toggleTable: (groupId: string, tableId: string) => void;
  /** Masaları gruba toplu atar (başka gruptaysa oradan taşınır). */
  assignTables: (groupId: string, tableIds: string[]) => void;
  /** Gruptaki tüm masaları serbest bırakır. */
  clearGroupTables: (groupId: string) => void;
  /** Grubu ekibe bağlar; grup ekibin rengini alır, gruptaki masaların atamaları ekibe geçer. */
  setGroupTeam: (groupId: string, teamId: string | null) => void;
  addTeam: () => void;
  updateTeam: (id: string, patch: Partial<DraftTeam>) => void;
  removeTeam: (id: string) => void;
  toggleMember: (teamId: string, staffId: string) => void;
  addAssignment: (type: DraftAssignment["assignmentType"]) => void;
  updateAssignment: (id: string, patch: Partial<DraftAssignment>) => void;
  removeAssignment: (id: string) => void;
  toggleAssignmentTable: (id: string, tableId: string) => void;
  autoAssign: (staffIds: string[], strategy: AutoAssignStrategy, shiftId: string | null, seed?: number) => void;
  /** Grup personeli penceresi: personeli grubun masalarına atar (mevcut masa atamasıyla birleşir). */
  addGroupStaff: (groupId: string, pick: StaffPick) => void;
  /** Grubun masalarını atamadan çıkarır; başka masası kalmazsa atama silinir. */
  removeGroupStaff: (groupId: string, assignmentId: string) => void;
  addServicePointStaff: (servicePointId: string, pick: StaffPick) => void;
  /** Noktanın rol listesini değiştirir; `key` verilirse aynı anahtarlı art arda yazımlar tek adımdır. */
  setPointRoles: (servicePointId: string, roles: DraftPointRoles["roles"], key?: string) => void;
  /** Ekstra personeli gruba bağlar ya da bağı kaldırır. */
  toggleExtraGroup: (extraId: string, groupId: string) => void;
  addExtra: () => void;
  updateExtra: (id: string, patch: Partial<DraftExtra>) => void;
  removeExtra: (id: string) => void;
};

function draftOf(src: Draft): Draft {
  return {
    teams: src.teams,
    groups: src.groups,
    assignments: src.assignments,
    extraStaff: src.extraStaff,
    servicePointRoles: src.servicePointRoles,
  };
}

/** Aynı kaydın aynı alanlarına art arda yazım tek geri alma adımıdır. */
const patchKey = (kind: string, id: string, patch: object) => `${kind}:${id}:${Object.keys(patch).sort().join(",")}`;

function newAssignment(type: DraftAssignment["assignmentType"], staffId: string, sortOrder: number): DraftAssignment {
  return {
    id: crypto.randomUUID(),
    staffId,
    shiftId: null,
    teamId: null,
    assignmentType: type,
    servicePointId: null,
    role: null,
    shiftStart: null,
    shiftEnd: null,
    specialTaskLocation: null,
    specialTaskStartTime: null,
    specialTaskEndTime: null,
    color: null,
    notes: null,
    sortOrder,
    tableIds: [],
  };
}

function pickedAssignment(pick: StaffPick, sortOrder: number): DraftAssignment {
  return {
    ...newAssignment("table", pick.staffId, sortOrder),
    shiftId: pick.shiftId,
    role: pick.role,
    shiftStart: pick.shiftStart ?? null,
    shiftEnd: pick.shiftEnd ?? null,
  };
}

const replaceById = <T extends { id: string }>(list: T[], id: string, patch: Partial<T>) =>
  list.map((item) => (item.id === id ? { ...item, ...patch } : item));

const toggle = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

export function createOrganizationStore(org: Organization): StoreApi<OrganizationState> {
  return createStore<OrganizationState>()((set, get) => {
    /** Taslağı değiştiren her eylem buradan geçer: önce geçmişe kayıt, sonra değişiklik. */
    const change = (updater: (s: OrganizationState) => Partial<Draft>, key: string | null = null) =>
      set((s) => {
        const patch = updater(s);
        if (Object.keys(patch).length === 0) return {};
        return { ...patch, history: record(s.history, draftOf(s), key), dirty: true };
      });
    return {
      ...draftOf(org),
      reference: { tables: org.tables, staff: org.staff, shifts: org.shifts, servicePoints: org.servicePoints, reviewHints: org.reviewHints },
      step: "groups",
      dirty: false,
      history: emptyHistory<Draft>(),
      undo: () =>
        set((s) => {
          const r = undoHistory(s.history, draftOf(s));
          return r ? { ...r.snapshot, history: r.history, dirty: isDirty(r.history) } : {};
        }),
      redo: () =>
        set((s) => {
          const r = redoHistory(s.history, draftOf(s));
          return r ? { ...r.snapshot, history: r.history, dirty: isDirty(r.history) } : {};
        }),
      setStep: (step) => set({ step }),
      reset: (next) =>
        set({
          ...draftOf(next),
          reference: { tables: next.tables, staff: next.staff, shifts: next.shifts, servicePoints: next.servicePoints, reviewHints: next.reviewHints },
          dirty: false,
          history: emptyHistory<Draft>(),
        }),
      addGroup: () =>
        change((s) => ({
          groups: [
            ...s.groups,
            {
              id: crypto.randomUUID(),
              name: `Grup ${s.groups.length + 1}`,
              color: pickColor(s.groups.length),
              teamId: null,
              supervisorStaffId: null,
              groupType: "standard",
              sortOrder: s.groups.length,
              notes: null,
              tableIds: [],
            },
          ],
        })),
      updateGroup: (id, patch) => change((s) => ({ groups: replaceById(s.groups, id, patch) }), patchKey("group", id, patch)),
      removeGroup: (id) =>
        change((s) => ({
          groups: s.groups.filter((g) => g.id !== id),
          extraStaff: s.extraStaff.map((e) => ({ ...e, groupIds: e.groupIds.filter((g) => g !== id) })),
        })),
      toggleTable: (groupId, tableId) =>
        change((s) => ({
          groups: s.groups.map((g) => {
            if (g.id === groupId) return { ...g, tableIds: toggle(g.tableIds, tableId) };
            return g.tableIds.includes(tableId) ? { ...g, tableIds: g.tableIds.filter((t) => t !== tableId) } : g;
          }),
        })),
      assignTables: (groupId, tableIds) =>
        change((s) => {
          const group = s.groups.find((g) => g.id === groupId);
          if (!group || tableIds.every((t) => group.tableIds.includes(t))) return {};
          return { groups: assignTablesToGroup(s.groups, groupId, tableIds) };
        }),
      clearGroupTables: (groupId) => change((s) => ({ groups: clearGroupTables(s.groups, groupId) })),
      setGroupTeam: (groupId, teamId) =>
        change((s) => {
          const group = s.groups.find((g) => g.id === groupId);
          const team = s.teams.find((t) => t.id === teamId);
          if (!group) return {};
          return {
            groups: replaceById(s.groups, groupId, team ? { teamId: team.id, color: team.color } : { teamId: null }),
            // Eski assignTeamToGroup davranışı: gruptaki masalara atanmış personel ekibe geçer.
            assignments: team
              ? s.assignments.map((a) => (a.tableIds.some((t) => group.tableIds.includes(t)) ? { ...a, teamId: team.id } : a))
              : s.assignments,
          };
        }),
      addTeam: () =>
        change((s) => ({
          teams: [
            ...s.teams,
            {
              id: crypto.randomUUID(),
              name: `Ekip ${s.teams.length + 1}`,
              color: pickColor(s.teams.length + 3),
              leaderStaffId: null,
              sortOrder: s.teams.length,
              isActive: true,
              members: [],
            },
          ],
        })),
      updateTeam: (id, patch) => change((s) => ({ teams: replaceById(s.teams, id, patch) }), patchKey("team", id, patch)),
      removeTeam: (id) =>
        change((s) => ({
          teams: s.teams.filter((t) => t.id !== id),
          groups: s.groups.map((g) => (g.teamId === id ? { ...g, teamId: null } : g)),
          assignments: s.assignments.map((a) => (a.teamId === id ? { ...a, teamId: null } : a)),
        })),
      toggleMember: (teamId, staffId) =>
        change((s) => ({
          teams: s.teams.map((t) => {
            if (t.id !== teamId) return t;
            const has = t.members.some((m) => m.staffId === staffId);
            return {
              ...t,
              leaderStaffId: has && t.leaderStaffId === staffId ? null : t.leaderStaffId,
              members: has
                ? t.members.filter((m) => m.staffId !== staffId)
                : [...t.members, { staffId, isLeader: false, role: null, shiftStart: null, shiftEnd: null }],
            };
          }),
        })),
      addAssignment: (type) => {
        const firstStaff = get().reference.staff[0];
        if (!firstStaff) return;
        change((s) => ({ assignments: [...s.assignments, newAssignment(type, firstStaff.id, s.assignments.length)] }));
      },
      updateAssignment: (id, patch) =>
        change((s) => ({ assignments: replaceById(s.assignments, id, patch) }), patchKey("assignment", id, patch)),
      removeAssignment: (id) => change((s) => ({ assignments: s.assignments.filter((a) => a.id !== id) })),
      toggleAssignmentTable: (id, tableId) =>
        change((s) => ({
          assignments: s.assignments.map((a) => (a.id === id ? { ...a, tableIds: toggle(a.tableIds, tableId) } : a)),
        })),
      autoAssign: (staffIds, strategy, shiftId, seed) =>
        change((s) => {
          const plan = planAutoAssign(s.reference.tables, staffIds, strategy, seed);
          let assignments = [...s.assignments];
          for (const entry of plan) {
            const existing = assignments.find(
              (a) => a.staffId === entry.staffId && a.shiftId === shiftId && a.assignmentType === "table",
            );
            if (existing) {
              assignments = replaceById(assignments, existing.id, { tableIds: entry.tableIds });
            } else {
              assignments.push({ ...newAssignment("table", entry.staffId, assignments.length), shiftId, tableIds: entry.tableIds });
            }
          }
          return { assignments };
        }),
      addGroupStaff: (groupId, pick) =>
        change((s) => {
          const group = s.groups.find((g) => g.id === groupId);
          if (!group) return {};
          return { assignments: addGroupStaff(s.assignments, pick, group, (p) => pickedAssignment(p, s.assignments.length)) };
        }),
      removeGroupStaff: (groupId, assignmentId) =>
        change((s) => {
          const group = s.groups.find((g) => g.id === groupId);
          return group ? { assignments: removeGroupStaff(s.assignments, assignmentId, group) } : {};
        }),
      addServicePointStaff: (servicePointId, pick) =>
        change((s) => ({
          assignments: addServicePointStaff(s.assignments, pick, servicePointId, (p) => pickedAssignment(p, s.assignments.length)),
        })),
      setPointRoles: (servicePointId, roles, key) =>
        change(
          (s) => ({
            servicePointRoles: s.servicePointRoles.some((p) => p.servicePointId === servicePointId)
              ? s.servicePointRoles.map((p) => (p.servicePointId === servicePointId ? { ...p, roles } : p))
              : [...s.servicePointRoles, { servicePointId, roles }],
          }),
          key ? `pointRoles:${servicePointId}:${key}` : null,
        ),
      toggleExtraGroup: (extraId, groupId) =>
        change((s) => ({
          extraStaff: s.extraStaff.map((e) => (e.id === extraId ? { ...e, groupIds: toggle(e.groupIds, groupId) } : e)),
        })),
      addExtra: () =>
        change((s) => ({
          extraStaff: [
            ...s.extraStaff,
            {
              id: crypto.randomUUID(),
              fullName: "",
              position: null,
              role: null,
              shiftStart: null,
              shiftEnd: null,
              color: null,
              notes: null,
              sortOrder: s.extraStaff.length,
              isActive: true,
              tableIds: [],
              groupIds: [],
            },
          ],
        })),
      updateExtra: (id, patch) => change((s) => ({ extraStaff: replaceById(s.extraStaff, id, patch) }), patchKey("extra", id, patch)),
      removeExtra: (id) => change((s) => ({ extraStaff: s.extraStaff.filter((e) => e.id !== id) })),
    };
  });
}

export const OrganizationStoreContext = createContext<StoreApi<OrganizationState> | null>(null);

export function useOrganization<T>(selector: (state: OrganizationState) => T): T {
  const store = useContext(OrganizationStoreContext);
  if (!store) throw new Error("OrganizationStoreContext eksik");
  return useStore(store, selector);
}

export function useOrganizationStoreApi(): StoreApi<OrganizationState> {
  const store = useContext(OrganizationStoreContext);
  if (!store) throw new Error("OrganizationStoreContext eksik");
  return store;
}

/** Taslağı sunucu girdisine çevirir (`saveOrganizationAction`). */
export function toSavePayload(eventId: string, s: Draft) {
  return {
    eventId,
    teams: s.teams.map((t) => ({ ...t, members: t.members.map((m) => ({ ...m })) })),
    groups: s.groups,
    assignments: s.assignments.map((a) => ({
      ...a,
      tableIds: a.assignmentType === "table" ? a.tableIds : [],
      servicePointId: a.assignmentType === "service_point" ? a.servicePointId : null,
    })),
    extraStaff: s.extraStaff,
    servicePointRoles: s.servicePointRoles,
  };
}
