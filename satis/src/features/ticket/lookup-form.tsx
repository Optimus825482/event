"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";
import { ERROR_MESSAGES } from "@/lib/core/errors";
import { lookupAction } from "./actions";

const INPUT = "min-h-11 w-full rounded-lg border bg-surface px-3 py-2 text-ivory";
const BUSY = "aria-disabled:cursor-not-allowed aria-disabled:border-transparent aria-disabled:bg-disabled-bg aria-disabled:text-disabled-text";

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
        router.push(`/bilet/${result.data.orderToken}`);
        return;
      }
      setFieldErrors(result.fieldErrors ?? {});
      setError(result.fieldErrors ? null : result.message);
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
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit" variant="gold" size="lg" aria-disabled={pending} className={BUSY}>
        Biletimi bul
      </Button>
    </form>
  );
}
