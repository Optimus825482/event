"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCustomerAction, updateCustomerAction } from "../actions";
import { useRunAction } from "./use-run-action";

export type EditableCustomer = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  vipScore: number;
  notes: string | null;
};

type Props = { customer?: EditableCustomer };

function FieldError({ messages }: { messages: string[] | undefined }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {messages.join(" ")}
    </p>
  );
}

export function CustomerForm({ customer }: Props) {
  const router = useRouter();
  const { pending, failure, run } = useRunAction();
  const errors = failure?.fieldErrors ?? {};

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");

    if (customer) {
      const vip = text("vipScore").trim();
      run(
        updateCustomerAction,
        {
          id: customer.id,
          fullName: text("fullName"),
          phone: text("phone"),
          email: text("email"),
          notes: text("notes"),
          ...(vip === "" ? {} : { vipScore: Number(vip) }),
        },
        () => router.refresh(),
        "Müşteri güncellendi",
      );
      return;
    }
    run(
      createCustomerAction,
      {
        fullName: text("fullName"),
        phone: text("phone"),
        email: text("email"),
        notes: text("notes"),
        tags: text("tags")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      },
      (data) => router.push(`/customers/${data.id}`),
      "Müşteri oluşturuldu",
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Ad soyad</Label>
          <Input id="fullName" name="fullName" defaultValue={customer?.fullName} required aria-invalid={!!errors.fullName} />
          <FieldError messages={errors.fullName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefon</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={customer?.phone ?? ""} placeholder="0555 123 45 67" aria-invalid={!!errors.phone} />
          <FieldError messages={errors.phone} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-posta</Label>
          <Input id="email" name="email" type="email" defaultValue={customer?.email ?? ""} aria-invalid={!!errors.email} />
          <FieldError messages={errors.email} />
        </div>
        {customer ? (
          <div className="space-y-1.5">
            <Label htmlFor="vipScore">VIP puanı (0-100)</Label>
            <Input id="vipScore" name="vipScore" type="number" min={0} max={100} defaultValue={customer.vipScore} aria-invalid={!!errors.vipScore} />
            <FieldError messages={errors.vipScore} />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="tags">Etiketler (virgülle ayırın)</Label>
            <Input id="tags" name="tags" placeholder="VIP, Düzenli" aria-invalid={!!errors.tags} />
            <FieldError messages={errors.tags} />
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notlar</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={customer?.notes ?? ""} aria-invalid={!!errors.notes} />
        <FieldError messages={errors.notes} />
      </div>
      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
        {failure && Object.keys(errors).length === 0 ? failure.message : null}
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Kaydediliyor…" : customer ? "Değişiklikleri kaydet" : "Müşteri oluştur"}
      </Button>
    </form>
  );
}
