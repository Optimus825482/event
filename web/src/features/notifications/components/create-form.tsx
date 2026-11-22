"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { createNotificationAction } from "../actions";
import { PRIORITY_LABELS, TARGET_ROLE_LABELS } from "../labels";
import { PRIORITIES, TARGET_ROLES } from "../schemas";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

/** Hedef role duyuru gönderir. */
export function CreateNotificationForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" ? value : "";
    };
    setPending(true);
    setMessage(null);
    try {
      const res = await createNotificationAction({
        title: text("title"),
        message: text("message"),
        priority: text("priority"),
        targetRole: text("targetRole"),
        actionUrl: text("actionUrl"),
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setMessage({ kind: "error", text: res.message });
        return;
      }
      setErrors({});
      setMessage({ kind: "ok", text: "Bildirim gönderildi" });
      formRef.current?.reset();
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Beklenmeyen bir hata oluştu" });
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border p-4" aria-busy={pending}>
      <h2 className="text-lg font-semibold">Yeni bildirim</h2>
      <Field label="Başlık" name="title" errors={errors.title}>
        <input id="title" name="title" required maxLength={200} className={inputClass} />
      </Field>
      <Field label="Mesaj" name="message" errors={errors.message}>
        <textarea id="message" name="message" required rows={3} maxLength={2000} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hedef rol" name="targetRole" errors={errors.targetRole}>
          <select id="targetRole" name="targetRole" defaultValue="all" className={inputClass}>
            {TARGET_ROLES.map((role) => (
              <option key={role} value={role}>
                {TARGET_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Öncelik" name="priority" errors={errors.priority}>
          <select id="priority" name="priority" defaultValue="medium" className={inputClass}>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Bağlantı (isteğe bağlı, ör. /events)" name="actionUrl" errors={errors.actionUrl}>
        <input id="actionUrl" name="actionUrl" placeholder="/events" className={inputClass} />
      </Field>
      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={message.kind === "error" ? "text-sm text-destructive" : "text-sm text-emerald-600"}
        >
          {message.text}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Gönderiliyor..." : "Gönder"}
      </Button>
    </form>
  );
}
