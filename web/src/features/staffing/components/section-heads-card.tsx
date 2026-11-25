"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { setSectionHeadsAction } from "../section-heads-actions";
import type { SectionHead } from "../section-heads-service";
import { draftWriteBlock } from "../draft-guard";
import { Section } from "./bits";
import { useOrganization } from "./store";

export const MAX_SECTION_HEADS = 10;

export type SectionHeadCandidate = { staffId: string; fullName: string };

export type SectionHeadRow = { staffId: string; fullName: string; active: boolean };

/**
 * Kartta gösterilen satırlar: adaylar ile mevcut kısım sorumluları birleşimi. Aday olmayan (ör. pasife
 * alınmış) mevcut sorumlu `active: false` ile listelenir; böylece kullanıcı onu kaldırıp kaydedebilir.
 * Bir kişi hem aday hem sorumluysa tek satır üretilir.
 */
export function sectionHeadRows(heads: SectionHead[], candidates: SectionHeadCandidate[]): SectionHeadRow[] {
  const rows = new Map<string, SectionHeadRow>();
  for (const c of candidates) rows.set(c.staffId, { staffId: c.staffId, fullName: c.fullName, active: true });
  for (const h of heads) {
    if (!rows.has(h.staffId)) rows.set(h.staffId, { staffId: h.staffId, fullName: h.fullName, active: false });
  }
  return [...rows.values()];
}

/** Açılış seçimi: mevcut kısım sorumluları. */
export function initialSectionHeadSelection(heads: SectionHead[]): string[] {
  return heads.map((h) => h.staffId);
}

type Props = {
  eventId: string;
  heads: SectionHead[];
  candidates: SectionHeadCandidate[];
  canEdit: boolean;
};

/** Etkinlik kısım sorumluları: personel listesinden çoklu seçim, "Kaydet" ile kümeyi değiştirir. */
export function SectionHeadsCard({ eventId, heads, candidates, canEdit }: Props) {
  const router = useRouter();
  const noteId = useId();
  const guard = draftWriteBlock(useOrganization((s) => s.dirty));
  const [selected, setSelected] = useState<string[]>(() => initialSectionHeadSelection(heads));
  const [message, setMessage] = useState<{ error: boolean; lines: string[] } | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = sectionHeadRows(heads, candidates);
  const saved = initialSectionHeadSelection(heads).sort().join(",");
  const dirty = selected.slice().sort().join(",") !== saved;

  const toggle = (staffId: string, checked: boolean) => {
    setSelected((current) =>
      checked
        ? current.includes(staffId) || current.length >= MAX_SECTION_HEADS
          ? current
          : [...current, staffId]
        : current.filter((id) => id !== staffId),
    );
  };

  const save = () => {
    if (guard.blocked) return;
    startTransition(async () => {
      setMessage(null);
      const res = await setSectionHeadsAction({ eventId, staffIds: selected });
      if (!res.ok) {
        setMessage({ error: true, lines: [res.message, ...Object.values(res.fieldErrors ?? {}).flat()] });
        return;
      }
      setMessage({ error: false, lines: ["Kısım sorumluları kaydedildi."] });
      router.refresh();
    });
  };

  return (
    <Section title="Kısım sorumluları">
      <p className="text-sm text-slate-400">
        Kısım sorumluları bu etkinliğin tamamını kapsar. En fazla {MAX_SECTION_HEADS} kişi atanabilir.
      </p>
      {heads.length === 0 ? (
        <p className="text-sm text-slate-500">Henüz kısım sorumlusu atanmadı.</p>
      ) : (
        <ul className="flex flex-wrap gap-2 text-sm">
          {heads.map((h) => (
            <li key={h.staffId} className="rounded-md bg-slate-800 px-2 py-1 text-slate-200">
              {h.fullName} <span className="text-slate-500">({h.sicilNo})</span>
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <div className="space-y-3">
          <fieldset className="grid gap-2 sm:grid-cols-2" disabled={pending}>
            <legend className="sr-only">Kısım sorumluları seçimi</legend>
            {rows.map((row) => {
              const checked = selected.includes(row.staffId);
              const full = !checked && selected.length >= MAX_SECTION_HEADS;
              return (
                <label key={row.staffId} className="flex items-center gap-2 text-sm text-slate-200">
                  <Checkbox
                    checked={checked}
                    disabled={full}
                    onCheckedChange={(value) => toggle(row.staffId, value === true)}
                  />
                  {row.fullName}
                  {row.active ? null : <span className="text-slate-500">(pasif)</span>}
                </label>
              );
            })}
          </fieldset>
          <div className="flex items-start gap-3">
            <Button type="button" onClick={save} disabled={pending || !dirty || guard.blocked}
              aria-describedby={guard.blocked ? noteId : undefined}
            >
              Kaydet
            </Button>
            {guard.note ? <p id={noteId} role="note" className="text-sm text-amber-400">{guard.note}</p> : null}
            {message ? (
              <div role="status" className={message.error ? "text-sm text-red-400" : "text-sm text-emerald-400"}>
                {message.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Section>
  );
}
