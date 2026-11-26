"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";
import { ERROR_MESSAGES } from "@/lib/core/errors";
import { payAction, releaseAction } from "./actions";
import { Countdown } from "./countdown-timer";
import { ExpiredView } from "./expired-view";

type Props = {
  orderToken: string;
  eventId: string;
  holdExpiresAt: string;
  serverNow: string;
  demo: boolean;
  /** Geri sayımın altında, formun üstünde gösterilen (ör. DEMO) bildirimler. */
  children?: ReactNode;
};

type Field = "firstName" | "lastName" | "email" | "phone";
const FIELDS: { name: Field; label: string; type: string; autoComplete: string; inputMode?: "email" | "tel" }[] = [
  { name: "firstName", label: "Ad", type: "text", autoComplete: "given-name" },
  { name: "lastName", label: "Soyad", type: "text", autoComplete: "family-name" },
  { name: "email", label: "E-posta", type: "email", autoComplete: "email", inputMode: "email" },
  { name: "phone", label: "Telefon (isteğe bağlı)", type: "tel", autoComplete: "tel", inputMode: "tel" },
];

const INPUT = "min-h-11 w-full rounded-lg border bg-surface px-3 py-2 text-ivory";

/** Geri sayım + alıcı formu; ödeme ve bırakma tek istekle ilerler (çift tıklama korumalı). */
export function PaymentForm({ orderToken, eventId, holdExpiresAt, serverNow, demo, children }: Props) {
  const router = useRouter();
  const [values, setValues] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [expired, setExpired] = useState(false);
  // Eşzamanlı ikinci tıklama state güncellenmeden gelebilir; ref anında kilitler.
  const busy = useRef(false);

  const markExpired = () => {
    setExpired(true);
    router.refresh();
  };

  if (expired) return <ExpiredView eventId={eventId} />;

  const submit = async (action: "approve" | "decline") => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await payAction(orderToken, action, { ...values, acceptTerms });
      if (result.ok) {
        router.replace(`/bilet/${orderToken}`);
        return; // yönlendirme sürerken düğmeler kilitli kalır
      }
      if (result.code === "hold_expired") {
        markExpired();
        return;
      }
      setError(result.message);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
    } catch {
      setError(ERROR_MESSAGES.core_unreachable);
    }
    busy.current = false;
    setPending(false);
  };

  const giveUp = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await releaseAction(orderToken);
      if (result.ok || result.code === "order_not_found" || result.code === "hold_expired") {
        router.replace(`/etkinlik/${eventId}`);
        return;
      }
      setError(result.message);
    } catch {
      setError(ERROR_MESSAGES.core_unreachable);
    }
    busy.current = false;
    setPending(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <Countdown holdExpiresAt={holdExpiresAt} serverNow={serverNow} onExpire={markExpired} />
      {children}
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit("approve");
        }}
      >
        {FIELDS.map((field) => {
          const message = fieldErrors[field.name];
          const id = `buyer-${field.name}`;
          return (
            <div key={field.name} className="flex flex-col gap-1">
              <label htmlFor={id} className="text-ivory">
                {field.label}
              </label>
              <input
                id={id}
                name={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                inputMode={field.inputMode}
                value={values[field.name]}
                disabled={pending}
                aria-invalid={message ? true : undefined}
                aria-describedby={message ? `${id}-error` : undefined}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                className={cn(INPUT, message ? "border-danger" : "border-muted")}
              />
              {message ? (
                <p id={`${id}-error`} className="m-0 text-danger">
                  {message}
                </p>
              ) : null}
            </div>
          );
        })}
        <div className="flex flex-col gap-1">
          <label className="flex min-h-11 items-start gap-3 text-ivory">
            <input
              type="checkbox"
              name="acceptTerms"
              checked={acceptTerms}
              disabled={pending}
              aria-invalid={fieldErrors.acceptTerms ? true : undefined}
              aria-describedby={fieldErrors.acceptTerms ? "buyer-acceptTerms-error" : undefined}
              onChange={(event) => setAcceptTerms(event.target.checked)}
              className="mt-1 size-5 shrink-0 accent-gold"
            />
            <span>
              <Link href="/kvkk" target="_blank" rel="noopener" className="text-gold underline">
                KVKK Aydınlatma Metni
              </Link>
              {"'ni ve "}
              <Link href="/mesafeli-satis" target="_blank" rel="noopener" className="text-gold underline">
                Mesafeli Satış Sözleşmesi
              </Link>
              {"'ni okudum, kabul ediyorum."}
            </span>
          </label>
          {fieldErrors.acceptTerms ? (
            <p id="buyer-acceptTerms-error" className="m-0 text-danger">
              {fieldErrors.acceptTerms}
            </p>
          ) : null}
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" variant="gold" size="lg" disabled={pending} className="sm:flex-1">
            Öde
          </Button>
          {demo ? (
            <Button variant="glass" size="lg" disabled={pending} onClick={() => void submit("decline")} className="sm:flex-1">
              Reddet (deneme)
            </Button>
          ) : null}
          <Button variant="ghost" size="lg" disabled={pending} onClick={() => void giveUp()}>
            Vazgeç
          </Button>
        </div>
      </form>
    </div>
  );
}
