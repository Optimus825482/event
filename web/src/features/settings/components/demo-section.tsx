"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  deleteDemoDataAction,
  resetDemoDataAction,
  setSalesDemoAction,
} from "@/features/demo/actions";
import type { DemoStatus } from "@/features/demo/service";
import { FormStatus, type FormState } from "@/features/users/components/field";

export function DemoSection({ status: initialStatus }: { status: DemoStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<DemoStatus>(initialStatus);
  const [formState, setFormState] = useState<FormState | null>(null);
  const [confirmKind, setConfirmKind] = useState<"reset" | "delete" | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(checked: boolean) {
    setFormState(null);
    startTransition(async () => {
      const res = await setSalesDemoAction({ enabled: checked });
      if (!res.ok) {
        setFormState({ ok: false, message: res.message });
        return;
      }
      setStatus(res.data);
      setFormState({
        ok: true,
        message: res.data.enabled ? "Demo modu açıldı" : "Demo modu kapatıldı",
      });
      router.refresh();
    });
  }

  function handleConfirm() {
    const kind = confirmKind;
    if (!kind) return;
    setFormState(null);
    startTransition(async () => {
      const res =
        kind === "reset"
          ? await resetDemoDataAction({ confirm: true })
          : await deleteDemoDataAction({ confirm: true });
      setConfirmKind(null);
      if (!res.ok) {
        setFormState({ ok: false, message: res.message });
        return;
      }
      setStatus(res.data);
      setFormState({
        ok: true,
        message: kind === "reset" ? "Demo verileri sıfırlandı" : "Demo verileri silindi",
      });
      router.refresh();
    });
  }

  return (
    <Card className="border-slate-700 bg-slate-800/50">
      <CardHeader>
        <CardTitle>Satış sitesi demo modu</CardTitle>
        <CardDescription>
          Açıkken satış sitesi yalnızca demo konserleri gösterir. Kapatınca demo veriler silinmez, siteden kalkar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <div className="space-y-1">
            <Label htmlFor="sales-demo-toggle" className="text-base font-medium text-slate-100">
              Satış sitesi demo aktif
            </Label>
            <p className="text-xs text-slate-400">
              Sitede değişiklik en geç 1 dakika içinde görünür.
            </p>
          </div>
          <Switch
            id="sales-demo-toggle"
            checked={status.enabled}
            disabled={isPending}
            onCheckedChange={handleToggle}
          />
        </div>

        <p className="text-sm text-slate-300">
          {status.eventCount} demo etkinlik · {status.orderCount} sipariş
        </p>

        <FormStatus state={formState} />

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setConfirmKind("reset")}
          >
            Demo verilerini sıfırla
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => setConfirmKind("delete")}
          >
            Demo verilerini sil
          </Button>
        </div>

        <ConfirmDialog
          open={confirmKind === "reset"}
          onOpenChange={(open) => {
            if (!open && !isPending) setConfirmKind(null);
          }}
          title="Demo verileri sıfırlansın mı?"
          description="Mevcut demo etkinlikler ve siparişleri silinip demo konserler güncel tarihlerle yeniden oluşturulur."
          confirmText="Sıfırla"
          cancelText="Vazgeç"
          variant="warning"
          loading={isPending}
          onConfirm={handleConfirm}
        />

        <ConfirmDialog
          open={confirmKind === "delete"}
          onOpenChange={(open) => {
            if (!open && !isPending) setConfirmKind(null);
          }}
          title="Demo verileri silinsin mi?"
          description="Demo etkinlikler, siparişleri, biletleri, arşiv kayıtları ve görselleri kalıcı olarak silinir. Bu işlem geri alınamaz."
          confirmText="Sil"
          cancelText="Vazgeç"
          variant="destructive"
          loading={isPending}
          onConfirm={handleConfirm}
        />
      </CardContent>
    </Card>
  );
}
