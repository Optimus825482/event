"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { BUSY_CLASS, inputClass } from "@/components/ui/form-field";
import { Notice } from "@/components/ui/notice";
import { ERROR_MESSAGES } from "@/lib/core/errors";
import { lookupAction } from "./actions";


/** PNR + soyad; form sunucu eylemiyle gönderilir (GET değil), PNR adrese yazılmaz. */
export function LookupForm() {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [pnr, setPnr] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await lookupAction({ pnr, lastName });
      if (result.ok) {
        try {
          router.push(`/bilet/${result.data.orderToken}`);
          return;
        } catch {
          setError(ERROR_MESSAGES.core_unreachable);
        }
      } else {
        const known = Object.keys(result.fieldErrors ?? {}).some((key) => key === "pnr" || key === "lastName");
        setFieldErrors(result.fieldErrors ?? {});
        setError(known ? null : result.message);
      }
    } catch {
      setError(ERROR_MESSAGES.core_unreachable);
    }
    busy.current = false;
    setPending(false);
  };

  const fields = [
    { name: "pnr", label: "PNR", value: pnr, set: setPnr, autoComplete: "off", autoCapitalize: "characters" },
    { name: "lastName", label: "Soyad", value: lastName, set: setLastName, autoComplete: "family-name", autoCapitalize: "words" },
  ] as const;

  return (
    <form
      noValidate
      method="post"
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {fields.map((field) => {
        const message = fieldErrors[field.name];
        const id = `lookup-${field.name}`;
        return (
          <div key={field.name} className="flex flex-col gap-1">
            <label htmlFor={id} className="text-ivory">
              {field.label}
            </label>
            <input
              id={id}
              name={field.name}
              type="text"
              autoComplete={field.autoComplete}
              autoCapitalize={field.autoCapitalize}
              spellCheck={false}
              value={field.value}
              readOnly={pending}
              aria-invalid={message ? true : undefined}
              aria-describedby={message ? `${id}-error` : undefined}
              onChange={(event) => field.set(event.target.value)}
              className={inputClass(Boolean(message))}
            />
            {message ? (
              <p id={`${id}-error`} className="m-0 text-danger">
                {message}
              </p>
            ) : null}
          </div>
        );
      })}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit" variant="gold" size="lg" aria-disabled={pending} className={BUSY_CLASS}>
        Biletimi bul
      </Button>
    </form>
  );
}
