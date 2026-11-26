"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Layers, Save, UserCog, UserPlus, Users } from "lucide-react";
import { StatCard } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { saveOrganizationAction } from "../actions";
import type { SectionHead } from "../section-heads-service";
import { Section } from "./bits";
import { useSupervisorName } from "./group-supervisor-field";
import { SectionHeadsCard } from "./section-heads-card";
import { toSavePayload, useOrganization, useOrganizationStoreApi } from "./store";

type Status = { kind: "ok" | "error"; message: string; details?: string[] } | null;

function detailsOf(fieldErrors: Record<string, string[]> | undefined): string[] {
  if (!fieldErrors) return [];
  return Object.entries(fieldErrors).flatMap(([field, messages]) => messages.map((m) => `${field}: ${m}`));
}

function SupervisorName({ staffId }: { staffId: string | null }) {
  const name = useSupervisorName(staffId);
  return <span className="text-muted-foreground">{name ? `Süpervizör: ${name}` : "Süpervizör yok"}</span>;
}

/** Adım 5: kontrol listesi ve tek transaction'lık kayıt. */
export function SummaryStep({ eventId, readOnly, sectionHeads }: { eventId: string; readOnly: boolean; sectionHeads: SectionHead[] }) {
  const staff = useOrganization((s) => s.reference.staff);
  const router = useRouter();
  const store = useOrganizationStoreApi();
  const teams = useOrganization((s) => s.teams);
  const groups = useOrganization((s) => s.groups);
  const assignments = useOrganization((s) => s.assignments);
  const extras = useOrganization((s) => s.extraStaff);
  const tables = useOrganization((s) => s.reference.tables);
  const dirty = useOrganization((s) => s.dirty);
  const [status, setStatus] = useState<Status>(null);
  const [pending, startTransition] = useTransition();

  const tableAssignments = assignments.filter((a) => a.assignmentType === "table").length;
  const grouped = new Set(groups.flatMap((g) => g.tableIds));
  const served = new Set(assignments.flatMap((a) => (a.assignmentType === "table" ? a.tableIds : [])));
  const warnings = [
    ...(tables.filter((t) => !grouped.has(t.id)).length > 0
      ? [`${tables.filter((t) => !grouped.has(t.id)).length} masa hiçbir grupta değil`]
      : []),
    ...groups.filter((g) => !g.teamId).map((g) => `"${g.name}" grubunun ekibi yok`),
    ...(tables.filter((t) => !t.isLoca && !served.has(t.id)).length > 0
      ? [`${tables.filter((t) => !t.isLoca && !served.has(t.id)).length} masaya personel atanmadı (localar hariç)`]
      : []),
    ...extras.filter((e) => e.fullName.trim() === "").map(() => "Adı boş ekstra personel var"),
  ];

  const save = () =>
    startTransition(async () => {
      setStatus(null);
      const res = await saveOrganizationAction(toSavePayload(eventId, store.getState()));
      if (res.ok) {
        setStatus({ kind: "ok", message: "Organizasyon kaydedildi." });
        router.refresh();
      } else {
        setStatus({ kind: "error", message: res.message, details: detailsOf(res.fieldErrors) });
      }
    });

  return (
    <div className="space-y-4">
      <Section title="Özet">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Ekip" value={teams.length} tone="blue" icon={<Users aria-hidden className="size-5" />} />
          <StatCard label="Grup" value={groups.length} tone="purple" icon={<Layers aria-hidden className="size-5" />} />
          <StatCard label="Masa ataması" value={tableAssignments} tone="emerald" icon={<UserCog aria-hidden className="size-5" />} />
          <StatCard label="Özel görev / servis noktası" value={assignments.length - tableAssignments} tone="amber" icon={<UserCog aria-hidden className="size-5" />} />
          <StatCard label="Ekstra personel" value={extras.length} tone="slate" icon={<UserPlus aria-hidden className="size-5" />} />
        </dl>
        {warnings.length > 0 ? (
          <ul className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
            {warnings.map((w, i) => (
              <li key={`${w}-${i}`} className="flex items-center gap-2">
                <AlertTriangle aria-hidden className="size-4 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Uyarı yok.</p>
        )}
      </Section>

      <Section title="Süpervizörler">
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Grup yok.</p>
        ) : (
          <ul className="space-y-1 text-sm" aria-label="Grup süpervizörleri">
            {groups.map((g) => (
              <li key={g.id} className="flex flex-wrap gap-x-2">
                <span className="font-medium">{g.name || "Adsız grup"}</span>
                <SupervisorName staffId={g.supervisorStaffId} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <SectionHeadsCard
        eventId={eventId}
        heads={sectionHeads}
        candidates={staff.map((p) => ({ staffId: p.id, fullName: p.fullName }))}
        canEdit={!readOnly}
      />

      {readOnly ? (
        <p className="text-sm text-muted-foreground">Bu etkinlikte değişiklik yapılamaz (yetki ya da etkinlik durumu).</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={pending}>
            <Save aria-hidden className="size-4" />
            {pending ? "Kaydediliyor…" : "Tümünü kaydet"}
          </Button>
          {dirty ? <span className="text-sm text-muted-foreground">Kaydedilmemiş değişiklikler var.</span> : null}
        </div>
      )}

      {status ? (
        <div role={status.kind === "error" ? "alert" : "status"} className="space-y-1 text-sm">
          <p className={status.kind === "error" ? "text-destructive" : "text-green-400"}>
            {status.message}
          </p>
          {status.details?.map((d) => (
            <p key={d} className="text-xs text-destructive">
              {d}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
