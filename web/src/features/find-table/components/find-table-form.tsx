"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findTableAction, type FindTableFormState } from "../actions";

const INITIAL: FindTableFormState = { error: null };

export function FindTableForm() {
  const [state, formAction, pending] = useActionState(findTableAction, INITIAL);
  // React 19 eylemden sonra formu sıfırlar; hatalı denemede yazılanlar korunsun diye alanlar denetimlidir (yalnızca bellekte).
  const [code, setCode] = useState("");
  const [lastName, setLastName] = useState("");
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Masamı bul</h1>
        <p id="find-table-help" className="text-sm text-muted-foreground">
          E-biletinizdeki PNR kodunu ya da rezervasyon kodunuzu ve soyadınızı girin.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="find-table-code">Rezervasyon kodu ya da PNR</Label>
        <Input
          id="find-table-code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={64}
          required
          aria-describedby="find-table-help"
          className="border-slate-400"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="find-table-last-name">Soyad</Label>
        <Input
          id="find-table-last-name"
          name="lastName"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          autoComplete="family-name"
          maxLength={100}
          required
          className="border-slate-400"
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-red-300">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="h-11">
        Masamı göster
      </Button>
    </form>
  );
}
