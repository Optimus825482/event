"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRunAction } from "@/features/customers/components/use-run-action";
import { Field, SELECT_CLASS } from "@/features/users/components/field";
import { updateReservationAction } from "../actions";
import type { AvailableTable } from "../read-service";

type Props = {
  reservation: {
    id: string;
    tableId: string;
    guestCount: number;
    guestName: string | null;
    guestPhone: string | null;
    guestEmail: string | null;
    specialRequests: string | null;
  };
  /** `excludeReservationId` ile alınmış liste: rezervasyonun kendi masası müsait görünür. */
  tables: AvailableTable[];
};

/** Masa değişimi, kişi sayısı ve misafir bilgisi. Boş bırakılan misafir alanı temizlenir. */
export function ReservationEditForm({ reservation, tables }: Props) {
  const router = useRouter();
  const { pending, failure, run } = useRunAction();
  const [saved, setSaved] = useState(false);
  const errors = failure?.fieldErrors ?? {};
  const options = tables.filter((t) => t.available);

  function submit(form: FormData) {
    const value = (key: string) => {
      const v = form.get(key);
      return typeof v === "string" ? v : undefined;
    };
    setSaved(false);
    run(
      updateReservationAction,
      {
        id: reservation.id,
        tableId: value("tableId"),
        guestCount: value("guestCount"),
        guestName: value("guestName") ?? "",
        guestPhone: value("guestPhone") ?? "",
        guestEmail: value("guestEmail") ?? "",
        specialRequests: value("specialRequests") ?? "",
      },
      () => {
        setSaved(true);
        router.refresh();
      },
      "Rezervasyon güncellendi",
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="tableId" label="Masa" errors={errors.tableId}>
          <select id="tableId" name="tableId" defaultValue={reservation.tableId} className={SELECT_CLASS}>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} ({t.capacity} kişilik{t.isLoca ? ", loca" : ""})
              </option>
            ))}
          </select>
        </Field>
        <Field id="guestCount" label="Kişi sayısı" errors={errors.guestCount}>
          <Input id="guestCount" name="guestCount" type="number" min={1} max={50} defaultValue={reservation.guestCount} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="guestName" label="Misafir adı" errors={errors.guestName}>
          <Input id="guestName" name="guestName" defaultValue={reservation.guestName ?? ""} />
        </Field>
        <Field id="guestPhone" label="Telefon" errors={errors.guestPhone}>
          <Input id="guestPhone" name="guestPhone" type="tel" defaultValue={reservation.guestPhone ?? ""} />
        </Field>
        <Field id="guestEmail" label="E-posta" errors={errors.guestEmail}>
          <Input id="guestEmail" name="guestEmail" type="email" defaultValue={reservation.guestEmail ?? ""} />
        </Field>
      </div>
      <Field id="specialRequests" label="Özel istek" errors={errors.specialRequests}>
        <Textarea id="specialRequests" name="specialRequests" rows={3} defaultValue={reservation.specialRequests ?? ""} />
      </Field>
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {failure.message}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-emerald-600">
          Kaydedildi.
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Kaydediliyor..." : "Kaydet"}
      </Button>
    </form>
  );
}
