"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Field, FormStatus, toFormState, type FormState } from "@/features/users/components/field";
import { uploadLogoAction } from "../actions";

export function LogoForm({ logo }: { logo: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState(null);
    startTransition(async () => {
      const result = await uploadLogoAction(data);
      setState(toFormState(result, "Logo güncellendi"));
      if (!result.ok) toast.error(result.message);
      if (result.ok) {
        toast.success("Logo güncellendi");
        form.reset();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4" noValidate>
      {logo ? (
        <Image
          src={`/api/uploads/${logo}`}
          alt="Firma logosu"
          width={128}
          height={64}
          unoptimized
          className="h-16 w-auto rounded border"
        />
      ) : (
        <p className="text-sm text-muted-foreground">Logo yüklenmemiş.</p>
      )}
      <div className="w-full max-w-xs">
        <Field id="logo-file" label="Yeni logo" errors={state?.fieldErrors?._root} hint="JPG, PNG veya WebP; en çok 5 MB">
          <Input id="logo-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
        </Field>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Yükleniyor…" : "Logoyu yükle"}
      </Button>
      <FormStatus state={state} />
    </form>
  );
}
