"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { applyTemplateAction, createTemplateAction, deleteTemplateAction } from "../actions";
import { EmptyState, Section } from "./bits";
import { useOrganization } from "./store";

export type TemplateItem = { id: string; name: string; description: string | null; isDefault: boolean };

type Props = {
  eventId: string;
  templates: TemplateItem[];
  canApply: boolean;
  canCreate: boolean;
  canDelete: boolean;
};

/** Organizasyon şablonları: kayıtlı durumdan şablon oluşturma, uygulama (atomik), silme. */
export function TemplatePanel({ eventId, templates, canApply, canCreate, canDelete }: Props) {
  const router = useRouter();
  const dirty = useOrganization((s) => s.dirty);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ error: boolean; lines: string[] } | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<{ kind: "apply" | "delete"; id: string } | null>(null);

  const run = (work: () => Promise<{ error: boolean; lines: string[] }>) =>
    startTransition(async () => {
      setMessage(null);
      const result = await work();
      setMessage(result);
      if (!result.error) router.refresh();
    });

  const create = () =>
    run(async () => {
      const res = await createTemplateAction({ eventId, name });
      if (!res.ok) return { error: true, lines: [res.message, ...Object.values(res.fieldErrors ?? {}).flat()] };
      setName("");
      return { error: false, lines: ["Şablon kaydedildi (son kaydedilmiş durumdan)."] };
    });

  const apply = (templateId: string) =>
    run(async () => {
      const res = await applyTemplateAction({ eventId, templateId });
      if (!res.ok) return { error: true, lines: [res.message] };
      const r = res.data;
      const lines = [`Şablon uygulandı: ${r.teams} ekip, ${r.groups} grup, ${r.assignments} atama.`];
      if (r.missingTables.length > 0) lines.push(`Bu etkinlikte bulunamayan masalar: ${r.missingTables.map((t) => t.label).join(", ")}`);
      if (r.missingStaffIds.length > 0) lines.push(`Bulunamayan ya da aktif olmayan personel: ${r.missingStaffIds.length}`);
      if (r.missingShiftIds.length > 0) lines.push(`Kullanılamayan vardiya nedeniyle atlanan atama vardiyası: ${r.missingShiftIds.length}`);
      if (r.missingServicePoints.length > 0) lines.push(`Bulunamayan servis noktaları: ${r.missingServicePoints.join(", ")}`);
      return { error: false, lines };
    });

  const remove = (id: string) =>
    run(async () => {
      const res = await deleteTemplateAction({ id });
      return res.ok ? { error: false, lines: ["Şablon silindi."] } : { error: true, lines: [res.message] };
    });

  return (
    <Section title="Organizasyon şablonları">
      {canCreate ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Şablon adı"
            placeholder="Şablon adı"
            className="max-w-xs"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button variant="outline" disabled={pending || name.trim() === ""} onClick={create}>
            Şablon olarak kaydet
          </Button>
          {dirty ? <span className="text-xs text-muted-foreground">Önce kaydedin: şablon kayıtlı durumdan alınır.</span> : null}
        </div>
      ) : null}
      {templates.length === 0 ? (
        <EmptyState>Kayıtlı şablon yok.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <span className="font-medium">{t.name}</span>
                {t.isDefault ? <span className="ml-2 text-xs text-muted-foreground">(varsayılan)</span> : null}
                {t.description ? <span className="block text-xs text-muted-foreground">{t.description}</span> : null}
              </span>
              <span className="flex gap-2">
                {canApply ? (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirming({ kind: "apply", id: t.id })}>
                    Uygula
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming({ kind: "delete", id: t.id })}>
                    Sil
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {message ? (
        <div role={message.error ? "alert" : "status"} className="space-y-1 text-sm">
          {message.lines.map((line) => (
            <p key={line} className={message.error ? "text-destructive" : undefined}>
              {line}
            </p>
          ))}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={confirming?.kind === "delete" ? "Şablon silinsin mi?" : "Şablon uygulansın mı?"}
        description={
          confirming?.kind === "delete"
            ? "Şablon listeden kaldırılır."
            : `Şablon bu etkinliğin ekip, grup ve atamalarının yerine geçer (ekstra personel korunur).${dirty ? " Kaydedilmemiş değişiklikler kaybolur." : ""}`
        }
        confirmText={confirming?.kind === "delete" ? "Sil" : "Uygula"}
        onConfirm={() => {
          if (!confirming) return;
          if (confirming.kind === "delete") remove(confirming.id);
          else apply(confirming.id);
          setConfirming(null);
        }}
        loading={pending}
      />
    </Section>
  );
}
