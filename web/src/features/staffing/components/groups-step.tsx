"use client";

import { Layers, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FloorPlanSwitcher } from "@/features/venue/components/floor-plan-switcher";
import type { FloorPlanData } from "@/features/venue/plan-types";
import { groupCoverage, groupPlanColors, groupPlanStatuses, UNGROUPED_PLAN_COLOR, withDraftGroups } from "../group-plan";
import { Chip, EmptyState, Section, Swatch } from "./bits";
import { GroupStaffDialog } from "./group-staff-dialog";
import { GroupSupervisorLine } from "./group-supervisor-line";
import { useOrganization } from "./store";

/** Adım 1: masaları gruplara ayırma (alan planında masaya tıklayarak). Bir masa yalnızca tek grupta olabilir. */
export function GroupsStep({ readOnly, plan }: { readOnly: boolean; plan: FloorPlanData }) {
  const groups = useOrganization((s) => s.groups);
  const tables = useOrganization((s) => s.reference.tables);
  const addGroup = useOrganization((s) => s.addGroup);
  const updateGroup = useOrganization((s) => s.updateGroup);
  const removeGroup = useOrganization((s) => s.removeGroup);
  const toggleTable = useOrganization((s) => s.toggleTable);
  const assignTables = useOrganization((s) => s.assignTables);
  const clearTables = useOrganization((s) => s.clearGroupTables);
  const [selected, setSelected] = useState<string | null>(null);
  const activeId = selected && groups.some((g) => g.id === selected) ? selected : (groups[0]?.id ?? null);
  const active = groups.find((g) => g.id === activeId) ?? null;
  const canEdit = !readOnly && active !== null;

  const groupOfTable = new Map<string, (typeof groups)[number]>();
  for (const g of groups) for (const t of g.tableIds) groupOfTable.set(t, g);
  const coverage = groupCoverage(tables, groups);
  // 3B görünüm yalnızca durum renklerini bilir: orada seçili grup mavi, diğerleri amber, grupsuz yeşil.
  const statuses = useMemo(() => groupPlanStatuses(plan.tables, groups, activeId), [plan.tables, groups, activeId]);
  const colors = useMemo(() => groupPlanColors(plan.tables, groups), [plan.tables, groups]);
  const draftPlan = useMemo(() => withDraftGroups(plan, groups), [plan, groups]);
  const outlinedIds = active?.tableIds;
  const ungroupedIds = tables.filter((t) => !groupOfTable.has(t.id)).map((t) => t.id);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Section
        title="Gruplar"
        actions={
          readOnly ? null : (
            <Button size="sm" variant="outline" onClick={addGroup}>
              Grup ekle
            </Button>
          )
        }
      >
        {groups.length === 0 ? (
          <EmptyState>Henüz grup yok.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {groups.map((g) => (
              <li
                key={g.id}
                className={`space-y-2 rounded-lg border p-2 ${g.id === activeId ? "border-blue-500 bg-blue-500/10" : "border-slate-700"}`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-white"
                    onClick={() => setSelected(g.id)}
                    aria-current={g.id === activeId}
                  >
                    <Swatch color={g.color} />
                    {g.name || "Adsız grup"}
                  </button>
                  <Badge variant="secondary">{g.tableIds.length} masa</Badge>
                  <GroupStaffDialog group={g} readOnly={readOnly} />
                </div>
                <GroupSupervisorLine group={g} />
                {g.id === activeId && !readOnly ? (
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label="Grup adı"
                      value={g.name}
                      onChange={(e) => updateGroup(g.id, { name: e.target.value })}
                    />
                    <input
                      type="color"
                      aria-label="Grup rengi"
                      value={g.color}
                      onChange={(e) => updateGroup(g.id, { color: e.target.value })}
                      className="h-9 w-10 rounded border border-input"
                    />
                    <Button size="sm" variant="ghost" onClick={() => removeGroup(g.id)}>
                      <Trash2 aria-hidden className="size-4" />
                      Sil
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={active ? `Masalar — seçili grup: ${active.name}` : "Masalar"}
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={ungroupedIds.length === 0}
                onClick={() => active && assignTables(active.id, ungroupedIds)}
              >
                <Layers aria-hidden className="size-4" />
                Grupsuzları ekle
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={active.tableIds.length === 0}
                onClick={() => clearTables(active.id)}
              >
                Grubu boşalt
              </Button>
            </div>
          ) : null
        }
      >
        <p className="text-xs text-slate-400">
          {canEdit
            ? "Planda masaya tıklayın: seçili gruba eklenir (başka gruptaysa oradan taşınır) ya da gruptan çıkar. Birden çok masa için \"Alan seç\" ile dikdörtgen çizin."
            : "Masaları atamak için bir grup seçin."}{" "}
          Grupsuz masa: {coverage.ungrouped} / {coverage.total} (grup kapsamı %{coverage.percent})
        </p>
        <ul aria-label="Plan açıklaması" className="flex flex-wrap gap-3 text-xs text-slate-400">
          {groups.map((g) => (
            <li key={g.id} className="inline-flex items-center gap-1.5">
              <Swatch color={g.color} /> {g.name || "Adsız grup"}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5">
            <Swatch color={UNGROUPED_PLAN_COLOR} /> Grupsuz
          </li>
          {active ? (
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-3 rounded-full border-2 border-white" /> Seçili grup (kalın kenarlık)
            </li>
          ) : null}
        </ul>
        {tables.length === 0 ? (
          <EmptyState>Bu etkinlikte masa yok. Önce yerleşim planında masa oluşturun.</EmptyState>
        ) : (
          <>
            <FloorPlanSwitcher
              plan={draftPlan}
              statuses={statuses}
              colorByTable={colors}
              outlinedIds={outlinedIds}
              onSelectMany={canEdit ? (ids) => active && assignTables(active.id, ids) : undefined}
              height={420}
              ariaLabel="Masa gruplama planı"
              onSelect={canEdit ? (id) => active && toggleTable(active.id, id) : undefined}
            />
            <details className="rounded-lg border border-slate-700 p-3">
              <summary className="cursor-pointer text-sm text-slate-300">Masa listesi</summary>
              <div className="mt-3 flex flex-wrap gap-2">
                {tables.map((t) => {
                  const owner = groupOfTable.get(t.id);
                  return (
                    <Chip
                      key={t.id}
                      active={owner !== undefined}
                      color={owner?.color}
                      disabled={!canEdit}
                      title={owner ? `${owner.name}` : "Grupsuz"}
                      onClick={() => active && toggleTable(active.id, t.id)}
                    >
                      {t.label}
                      {t.isLoca ? " (loca)" : ""}
                    </Chip>
                  );
                })}
              </div>
            </details>
          </>
        )}
      </Section>
    </div>
  );
}
