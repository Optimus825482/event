"use client";

import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, SELECT_CLASS } from "@/features/users/components/field";
import { realtimeKeys } from "@/features/realtime/keys";
import { freeTablesAction } from "../actions";
import { walkInInput } from "../schemas";
import { unwrap } from "./use-check-in";
import type { WalkInTarget } from "../offline/queue-core";

/**
 * Kapıda gelen misafir: boş masa seçilir, kayıt ve giriş tek işlemde yapılır. Girdi aynı Zod şemasıyla
 * doğrulanır ve çevrimdışı kuyruğa (check-in ile aynı yol) verilir; sonuç ana ekrandaki bantta görünür.
 */
export function WalkInForm({
  eventId,
  pending,
  onSubmit,
}: {
  eventId: string;
  pending: boolean;
  onSubmit: (walkIn: WalkInTarget) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formKey, setFormKey] = useState(0);
  const tables = useQuery({
    queryKey: [...realtimeKeys.tables(eventId), "walk-in"],
    queryFn: async () => unwrap(await freeTablesAction({ eventId })),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = walkInInput.safeParse({
      eventId,
      tableId: form.get("tableId"),
      guestName: form.get("guestName"),
      guestCount: form.get("guestCount"),
      guestPhone: form.get("guestPhone"),
    });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    const { tableId, guestName, guestCount, guestPhone } = parsed.data;
    setErrors({});
    setFormKey((k) => k + 1);
    onSubmit({ tableId, guestName, guestCount, ...(guestPhone ? { guestPhone } : {}) });
  }

  const free = tables.data ?? [];
  return (
    <form
      key={formKey}
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4"
      aria-label="Walk-in misafir kaydı"
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
        <UserPlus className="h-5 w-5 text-emerald-400" aria-hidden="true" />
        Walk-in misafir
      </h2>
      <Field id="walk-in-table" label="Masa" errors={errors.tableId}>
        <select id="walk-in-table" name="tableId" className={`${SELECT_CLASS} border-slate-600 bg-slate-900 text-white`} defaultValue="" required>
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
      <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-500" disabled={pending || free.length === 0}>
        {pending ? "Kaydediliyor…" : "Kaydet ve giriş yap"}
      </Button>
    </form>
  );
}
