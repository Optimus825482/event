"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { createEventAction, updateEventAction } from "../actions";

export type EventFormValues = {
  id: string;
  name: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  eventType: string | null;
  reservationEnabled: boolean;
};

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** ISO anını tarayıcının yerel saatiyle `datetime-local` değerine çevirir. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Yerel `datetime-local` değerini ISO'ya çevirir; boşsa `undefined`. */
function toIso(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === "string" ? value : "";
  return text === "" ? undefined : new Date(text).toISOString();
}

function Field({
  label,
  name,
  errors,
  children,
}: {
  label: string;
  name: string;
  errors?: string[] | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {errors?.map((message) => (
        <p key={message} role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ))}
    </div>
  );
}

export function EventForm({ event }: { event?: EventFormValues }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      startsAt: toIso(form.get("startsAt")),
      endsAt: toIso(form.get("endsAt")),
      eventType: String(form.get("eventType") ?? ""),
      reservationEnabled: form.get("reservationEnabled") === "on",
    };
    setPending(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const res = event
        ? await updateEventAction({ ...payload, id: event.id })
        : await createEventAction(payload);
      if (!res.ok) {
        setFormError(res.message);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      router.push(`/events/${res.data.id}`);
      router.refresh();
    } catch {
      setFormError("Beklenmeyen bir hata oluştu");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4" noValidate>
      <Field label="Etkinlik adı" name="name" errors={fieldErrors.name}>
        <input id="name" name="name" defaultValue={event?.name ?? ""} required className={inputClass} />
      </Field>
      <Field label="Açıklama" name="description" errors={fieldErrors.description}>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={event?.description ?? ""}
          className={inputClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Başlangıç" name="startsAt" errors={fieldErrors.startsAt}>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={toLocalInput(event?.startsAt ?? null)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Bitiş (isteğe bağlı)" name="endsAt" errors={fieldErrors.endsAt}>
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={toLocalInput(event?.endsAt ?? null)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Etkinlik türü" name="eventType" errors={fieldErrors.eventType}>
        <input id="eventType" name="eventType" defaultValue={event?.eventType ?? ""} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="reservationEnabled"
          defaultChecked={event?.reservationEnabled ?? true}
        />
        Rezervasyon alınabilir
      </label>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : event ? "Kaydet" : "Etkinlik oluştur"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
