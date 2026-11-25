"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { APP_TIME_ZONE, dateToZonedWallClock, zonedWallClockToDate } from "@/lib/time-zone";
import { EVENT_TYPE_SUGGESTIONS } from "../board";
import { createEventAction, updateEventAction } from "../actions";

export type EventFormValues = {
  id: string;
  name: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  eventType: string | null;
  /** Verilmezse (çağıran bilmiyorsa) kayıtta sanatçı adına dokunulmaz. */
  artistName?: string | null;
  reservationEnabled: boolean;
};

type Props = {
  event?: EventFormValues;
  /** Verilirse kayıttan sonra yönlendirme yapılmaz; çağıran (iletişim kutusu, sihirbaz) devam eder. */
  onSaved?: (id: string) => void;
  /** Verilirse "Vazgeç" bu işlevi çağırır; yoksa bir önceki sayfaya dönülür. */
  onCancel?: () => void;
  submitLabel?: string;
  /** Hata alanlarının id çakışmaması için (aynı sayfada birden çok form). */
  idPrefix?: string;
};

export const eventInputClass =
  "w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-blue-500";

/** ISO anını uygulama saat dilimindeki (Kıbrıs) `datetime-local` değerine çevirir; tarayıcı dilimi etkilemez. */
function toLocalInput(iso: string | null): string {
  return iso ? dateToZonedWallClock(new Date(iso), APP_TIME_ZONE) : "";
}

/** Kıbrıs duvar saati olarak girilen `datetime-local` değerini ISO'ya çevirir; boş ya da geçersizse `undefined`. */
function toIso(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === "string" ? value : "";
  return zonedWallClockToDate(text, APP_TIME_ZONE)?.toISOString();
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
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm text-slate-400">
        {label}
      </label>
      {children}
      {errors?.map((message) => (
        <p key={message} role="alert" className="text-sm text-red-400">
          {message}
        </p>
      ))}
    </div>
  );
}

export function EventForm({ event, onSaved, onCancel, submitLabel, idPrefix = "" }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const id = (name: string) => `${idPrefix}${name}`;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      startsAt: toIso(form.get("startsAt")),
      endsAt: toIso(form.get("endsAt")),
      eventType: String(form.get("eventType") ?? ""),
      // Düzenlemede çağıran sanatçı adını bilmiyorsa alan gönderilmez; aksi halde boş alan onu siler.
      artistName: event && event.artistName === undefined ? undefined : String(form.get("artistName") ?? ""),
      reservationEnabled: form.get("reservationEnabled") === "on",
    };
    setPending(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const res = event ? await updateEventAction({ ...payload, id: event.id }) : await createEventAction(payload);
      if (!res.ok) {
        setFormError(res.message);
        setFieldErrors(res.fieldErrors ?? {});
        toast.error(res.message);
        return;
      }
      toast.success(event ? "Etkinlik güncellendi" : "Etkinlik oluşturuldu");
      if (onSaved) {
        onSaved(res.data.id);
        return;
      }
      router.push(`/events/${res.data.id}`);
      router.refresh();
    } catch {
      setFormError("Beklenmeyen bir hata oluştu");
      toast.error("Beklenmeyen bir hata oluştu");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field label="Etkinlik adı" name={id("name")} errors={fieldErrors.name}>
        <input id={id("name")} name="name" defaultValue={event?.name ?? ""} required className={eventInputClass} />
      </Field>
      <Field label="Açıklama" name={id("description")} errors={fieldErrors.description}>
        <textarea
          id={id("description")}
          name="description"
          rows={3}
          defaultValue={event?.description ?? ""}
          className={eventInputClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Başlangıç" name={id("startsAt")} errors={fieldErrors.startsAt}>
          <input
            id={id("startsAt")}
            name="startsAt"
            type="datetime-local"
            defaultValue={toLocalInput(event?.startsAt ?? null)}
            required
            className={eventInputClass}
          />
        </Field>
        <Field label="Bitiş (isteğe bağlı)" name={id("endsAt")} errors={fieldErrors.endsAt}>
          <input
            id={id("endsAt")}
            name="endsAt"
            type="datetime-local"
            defaultValue={toLocalInput(event?.endsAt ?? null)}
            className={eventInputClass}
          />
        </Field>
      </div>
      <Field label="Etkinlik türü" name={id("eventType")} errors={fieldErrors.eventType}>
        <input
          id={id("eventType")}
          name="eventType"
          list={id("eventTypeList")}
          defaultValue={event?.eventType ?? ""}
          className={eventInputClass}
        />
        <datalist id={id("eventTypeList")}>
          {EVENT_TYPE_SUGGESTIONS.map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>
      </Field>
      <Field label="Sanatçı" name={id("artistName")} errors={fieldErrors.artistName}>
        <input
          id={id("artistName")}
          name="artistName"
          placeholder="Örn. Sanatçı veya grup adı"
          defaultValue={event?.artistName ?? ""}
          className={eventInputClass}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" name="reservationEnabled" defaultChecked={event?.reservationEnabled ?? true} />
        Rezervasyon alınabilir
      </label>
      {formError ? (
        <p role="alert" className="text-sm text-red-400">
          {formError}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-slate-600 bg-transparent"
          onClick={() => (onCancel ? onCancel() : router.back())}
          disabled={pending}
        >
          Vazgeç
        </Button>
        <Button type="submit" disabled={pending} className="bg-blue-600 text-white hover:bg-blue-700">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pending ? "Kaydediliyor…" : (submitLabel ?? (event ? "Kaydet" : "Etkinlik oluştur"))}
        </Button>
      </div>
    </form>
  );
}
