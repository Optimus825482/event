"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { SALE_MODE_LABELS } from "@/domain/seating";
import { SIGHTLINE_SETS } from "@/features/sales-api/contract";
import { Field, FormStatus, SELECT_CLASS, toFormState, type FormState } from "@/features/users/components/field";
import { dateToZonedWallClock } from "@/lib/time-zone";
import { saveSiteContentAction } from "../actions";
import type { SiteContentView } from "../content-service";
import { SIGHTLINE_SET_LABELS } from "../labels";

export function SiteContentForm({ view, canEdit }: { view: SiteContentView; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(null);

  const [summary, setSummary] = useState(view.summary ?? "");
  const [doorsOpenAt, setDoorsOpenAt] = useState(
    view.doorsOpenAt ? dateToZonedWallClock(new Date(view.doorsOpenAt)) : "",
  );
  const [ageLimit, setAgeLimit] = useState(view.ageLimit ?? "");
  const [dressCode, setDressCode] = useState(view.dressCode ?? "");
  const [sightlineSet, setSightlineSet] = useState<string>(view.sightlineSet ?? "");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    setState(null);
    startTransition(async () => {
      const result = await saveSiteContentAction({
        eventId: view.eventId,
        summary,
        doorsOpenAt,
        ageLimit,
        dressCode,
        sightlineSet,
      });
      setState(toFormState(result, "Site içeriği kaydedildi"));
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Site içeriği kaydedildi");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">
        Satış şekli: <span className="font-medium text-foreground">{SALE_MODE_LABELS[view.saleMode]}</span>
      </p>

      <Field id="site-summary" label="Tanıtım metni" errors={state?.fieldErrors?.summary}>
        <Textarea
          id="site-summary"
          rows={4}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={!canEdit || pending}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="site-doors-open-at" label="Kapı saati" errors={state?.fieldErrors?.doorsOpenAt}>
          <Input
            id="site-doors-open-at"
            type="datetime-local"
            value={doorsOpenAt}
            onChange={(e) => setDoorsOpenAt(e.target.value)}
            disabled={!canEdit || pending}
          />
        </Field>

        <Field id="site-age-limit" label="Yaş sınırı" errors={state?.fieldErrors?.ageLimit}>
          <Input
            id="site-age-limit"
            value={ageLimit}
            onChange={(e) => setAgeLimit(e.target.value)}
            disabled={!canEdit || pending}
          />
        </Field>

        <Field id="site-dress-code" label="Kıyafet" errors={state?.fieldErrors?.dressCode}>
          <Input
            id="site-dress-code"
            value={dressCode}
            onChange={(e) => setDressCode(e.target.value)}
            disabled={!canEdit || pending}
          />
        </Field>

        <Field id="site-sightline-set" label="Sahne görüşü" errors={state?.fieldErrors?.sightlineSet}>
          <select
            id="site-sightline-set"
            className={SELECT_CLASS}
            value={sightlineSet}
            onChange={(e) => setSightlineSet(e.target.value)}
            disabled={!canEdit || pending}
          >
            <option value="">Fotoğraf yok</option>
            {SIGHTLINE_SETS.map((key) => (
              <option key={key} value={key}>
                {SIGHTLINE_SET_LABELS[key]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {canEdit ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
          <FormStatus state={state} />
        </div>
      ) : null}
    </form>
  );
}
