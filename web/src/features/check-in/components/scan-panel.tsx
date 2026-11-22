"use client";

import { QrCode } from "lucide-react";
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
    <form
      onSubmit={submit}
      className="space-y-2 rounded-xl border border-slate-700 bg-slate-800 p-4"
      aria-label="QR kod ile giriş"
    >
      <div className="flex items-center gap-2">
        <QrCode className="h-4 w-4 text-emerald-400" aria-hidden="true" />
        <Label htmlFor="check-in-code" className="text-slate-200">
          QR kod
        </Label>
      </div>
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
          className="h-12 border-slate-600 bg-slate-900 text-base text-white placeholder:text-slate-500"
        />
        <Button
          type="submit"
          size="lg"
          className="h-12 bg-emerald-600 text-white hover:bg-emerald-500"
          disabled={pending || value.trim() === ""}
        >
          {pending ? "Gönderiliyor…" : "Giriş yap"}
        </Button>
      </div>
    </form>
  );
}
