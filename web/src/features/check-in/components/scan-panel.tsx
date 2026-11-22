"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * QR girişi. Tek giriş noktası `onScan(token)`: el okuyucusu (klavye gibi yazıp Enter basar),
 * yapıştırılan içerik ya da ileride kamera okuyucusu (Task 18) aynı işlevi çağırır.
 */
export function ScanPanel({ onScan, pending }: { onScan: (token: string) => void; pending: boolean }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = value.trim();
    if (!token) return;
    onScan(token);
    setValue("");
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={submit} className="space-y-2" aria-label="QR kod ile giriş">
      <Label htmlFor="check-in-code">QR kod</Label>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          id="check-in-code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="QR kodu okutun ya da yapıştırın"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          className="h-12 text-base"
        />
        <Button type="submit" size="lg" className="h-12" disabled={pending || value.trim() === ""}>
          {pending ? "Gönderiliyor…" : "Giriş yap"}
        </Button>
      </div>
    </form>
  );
}
