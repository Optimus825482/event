"use client";

import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { resendOrderEmailAction } from "../actions";

const FAILED_MESSAGE = "İşlem tamamlanamadı";

/** "E-bileti yeniden gönder"; başarıda toast, hatada sunucu mesajı (toast + kalıcı metin). */
export function ResendButton({ orderId }: { orderId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      const result = await resendOrderEmailAction({ orderId });
      if (result.ok) {
        toast.success(`E-bilet gönderildi: ${result.data.sentTo}`);
        router.refresh();
      } else {
        setError(result.message);
        toast.error(result.message);
      }
    } catch {
      setError(FAILED_MESSAGE);
      toast.error(FAILED_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" className="h-11" disabled={busy} onClick={resend}>
        <Mail aria-hidden />
        {busy ? "Gönderiliyor…" : "E-bileti yeniden gönder"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
