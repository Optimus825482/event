"use client";

import { useRouter } from "next/navigation";
import { CheckCheck, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { markAllNotificationsReadAction, markNotificationReadAction } from "../actions";

export function MarkReadButton({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const res = await markNotificationReadAction({ id });
      if (!res.ok) {
        setError(res.message);
        toast.error(res.message);
      } else {
        toast.success("Bildirim okundu olarak işaretlendi");
        router.refresh();
      }
    } catch {
      setError("Beklenmeyen bir hata oluştu");
      toast.error("Beklenmeyen bir hata oluştu");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-slate-600 bg-transparent text-slate-200 hover:bg-slate-700"
        disabled={pending}
        onClick={() => void run()}
      >
        <Check aria-hidden="true" />
        Okundu işaretle
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const res = await markAllNotificationsReadAction({});
      if (!res.ok) {
        setError(res.message);
        toast.error(res.message);
      } else {
        toast.success("Tüm bildirimler okundu olarak işaretlendi");
        router.refresh();
      }
    } catch {
      setError("Beklenmeyen bir hata oluştu");
      toast.error("Beklenmeyen bir hata oluştu");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        className="border-slate-600 bg-transparent text-slate-200 hover:bg-slate-700"
        disabled={disabled || pending}
        onClick={() => void run()}
      >
        <CheckCheck aria-hidden="true" />
        Tümünü okundu işaretle
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
