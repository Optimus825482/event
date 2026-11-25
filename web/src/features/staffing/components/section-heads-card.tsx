"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { setSectionHeadsAction } from "../section-heads-actions";
import type { SectionHead } from "../section-heads-service";
import { Section } from "./bits";

export const MAX_SECTION_HEADS = 10;

export type SectionHeadCandidate = { staffId: string; fullName: string };

type Props = {
  eventId: string;
  heads: SectionHead[];
  candidates: SectionHeadCandidate[];
  canEdit: boolean;
};

/** Etkinlik kısım sorumluları: personel listesinden çoklu seçim, "Kaydet" ile kümeyi değiştirir. */
export function SectionHeadsCard({ eventId, heads, candidates, canEdit }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(() => heads.map((h) => h.staffId));
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const saved = heads.map((h) => h.staffId).sort().join(",");
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

  const save = () =>
    startTransition(async () => {
      setMessage(null);
      const res = await setSectionHeadsAction({ eventId, staffIds: selected });
      if (!res.ok) {
        setMessage({ error: true, text: [res.message, ...Object.values(res.fieldErrors ?? {}).flat()].join(" ") });
        return;
      }
      setMessage({ error: false, text: "Kısım sorumluları kaydedildi." });
      router.refresh();
    });

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
            {candidates.map((c) => {
              const checked = selected.includes(c.staffId);
              const full = !checked && selected.length >= MAX_SECTION_HEADS;
              return (
                <label key={c.staffId} className="flex items-center gap-2 text-sm text-slate-200">
                  <Checkbox
                    checked={checked}
                    disabled={full}
                    onCheckedChange={(value) => toggle(c.staffId, value === true)}
                  />
                  {c.fullName}
                </label>
              );
            })}
          </fieldset>
          <div className="flex items-center gap-3">
            <Button type="button" onClick={save} disabled={pending || !dirty}>
              Kaydet
            </Button>
            {message ? (
              <span role="status" className={message.error ? "text-sm text-red-400" : "text-sm text-emerald-400"}>
                {message.text}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </Section>
  );
}
