"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveOrganizationAction } from "../actions";
import { Section } from "./bits";
import { toSavePayload, useOrganization, useOrganizationStoreApi } from "./store";

type Status = { kind: "ok" | "error"; message: string; details?: string[] } | null;

function detailsOf(fieldErrors: Record<string, string[]> | undefined): string[] {
  if (!fieldErrors) return [];
  return Object.entries(fieldErrors).flatMap(([field, messages]) => messages.map((m) => `${field}: ${m}`));
}

/** Adım 5: kontrol listesi ve tek transaction'lık kayıt. */
export function SummaryStep({ eventId, readOnly }: { eventId: string; readOnly: boolean }) {
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
        <dl className="grid gap-3 sm:grid-cols-5">
          {[
            ["Ekip", teams.length],
            ["Grup", groups.length],
            ["Masa ataması", assignments.filter((a) => a.assignmentType === "table").length],
            ["Özel görev / servis noktası", assignments.filter((a) => a.assignmentType !== "table").length],
            ["Ekstra personel", extras.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-md border border-border p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        {warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-400">
            {warnings.map((w, i) => (
              <li key={`${w}-${i}`}>{w}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Uyarı yok.</p>
        )}
      </Section>

      {readOnly ? (
        <p className="text-sm text-muted-foreground">Bu etkinlikte değişiklik yapılamaz (yetki ya da etkinlik durumu).</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={pending}>
            {pending ? "Kaydediliyor…" : "Tümünü kaydet"}
          </Button>
          {dirty ? <span className="text-sm text-muted-foreground">Kaydedilmemiş değişiklikler var.</span> : null}
        </div>
      )}

      {status ? (
        <div role={status.kind === "error" ? "alert" : "status"} className="space-y-1 text-sm">
          <p className={status.kind === "error" ? "text-destructive" : "text-green-700 dark:text-green-400"}>
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
