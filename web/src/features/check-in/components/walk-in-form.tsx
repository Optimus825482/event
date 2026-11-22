"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, SELECT_CLASS } from "@/features/users/components/field";
import { realtimeKeys } from "@/features/realtime/keys";
import { freeTablesAction, registerWalkInAction } from "../actions";
import { unwrap, useRefreshEvent, type CheckInFeedback } from "./use-check-in";

/** Kapıda gelen misafir: boş masa seçilir, kayıt ve giriş tek işlemde yapılır. */
export function WalkInForm({ eventId, onDone }: { eventId: string; onDone: (feedback: CheckInFeedback) => void }) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formKey, setFormKey] = useState(0);
  const refresh = useRefreshEvent(eventId);
  const tables = useQuery({
    queryKey: [...realtimeKeys.tables(eventId), "walk-in"],
    queryFn: async () => unwrap(await freeTablesAction({ eventId })),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await registerWalkInAction({
        eventId,
        tableId: form.get("tableId"),
        guestName: form.get("guestName"),
        guestCount: form.get("guestCount"),
        guestPhone: form.get("guestPhone"),
      });
      if (result.ok) {
        setErrors({});
        setFormKey((k) => k + 1);
        onDone({ kind: "success", result: result.data });
        refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        onDone({ kind: "error", code: result.code, message: result.message });
      }
    });
  }

  const free = tables.data ?? [];
  return (
    <form key={formKey} onSubmit={submit} className="space-y-3" aria-label="Walk-in misafir kaydı">
      <h2 className="text-lg font-semibold">Walk-in misafir</h2>
      <Field id="walk-in-table" label="Masa" errors={errors.tableId}>
        <select id="walk-in-table" name="tableId" className={SELECT_CLASS} defaultValue="" required>
          <option value="" disabled>
            {tables.isLoading ? "Masalar yükleniyor…" : free.length === 0 ? "Boş masa yok" : "Boş masa seçin"}
          </option>
          {free.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label} ({t.capacity} kişilik)
            </option>
          ))}
        </select>
      </Field>
      <Field id="walk-in-name" label="Misafir adı" errors={errors.guestName}>
        <Input id="walk-in-name" name="guestName" required maxLength={100} autoComplete="off" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="walk-in-count" label="Kişi sayısı" errors={errors.guestCount}>
          <Input id="walk-in-count" name="guestCount" type="number" min={1} max={50} defaultValue={1} required />
        </Field>
        <Field id="walk-in-phone" label="Telefon (isteğe bağlı)" errors={errors.guestPhone}>
          <Input id="walk-in-phone" name="guestPhone" type="tel" autoComplete="off" />
        </Field>
      </div>
      <Button type="submit" disabled={pending || free.length === 0}>
        {pending ? "Kaydediliyor…" : "Kaydet ve giriş yap"}
      </Button>
    </form>
  );
}
