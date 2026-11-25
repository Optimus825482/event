"use client";

import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { WizardTemplate } from "../board";

export type ApplyOutcome = { ok: true; message: string } | { ok: false; message: string };

type Props = {
  templates: WizardTemplate[];
  /** Şablonu uygulama yetkisi var mı? Yoksa yalnızca yönlendirme gösterilir. */
  canApply: boolean;
  apply: (templateId: string) => Promise<ApplyOutcome>;
  onNext: () => void;
  emptyTitle: string;
  emptyDescription: string;
  /** Şablonsuz/elle devam için bağlantı; hedef sayfaya erişim izni yoksa `null` (bağlantı gösterilmez). */
  manualHref: string | null;
  manualLabel: string;
  icon: ReactNode;
};

/** Şablon seçip uygulama adımı (alan şablonu ve ekip ataması için ortak). */
export function WizardTemplateStep({
  templates,
  canApply,
  apply,
  onNext,
  emptyTitle,
  emptyDescription,
  manualHref,
  manualLabel,
  icon,
}: Props) {
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);

  async function handleApply() {
    if (!selected) return;
    setPending(true);
    try {
      const outcome = await apply(selected);
      if (!outcome.ok) {
        toast.error(outcome.message);
        return;
      }
      toast.success(outcome.message);
      setApplied(selected);
    } catch {
      toast.error("Beklenmeyen bir hata oluştu");
    } finally {
      setPending(false);
    }
  }

  if (templates.length === 0 || !canApply) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={icon}
          title={emptyTitle}
          description={emptyDescription}
          action={
            manualHref ? (
              <Link href={manualHref} className={cn(buttonVariants({ variant: "outline" }), "border-slate-600 bg-transparent")}>
                {manualLabel}
              </Link>
            ) : null
          }
        />
        <div className="flex justify-end">
          <Button onClick={onNext} className="bg-blue-600 text-white hover:bg-blue-700">
            Devam
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ul className="grid gap-3 sm:grid-cols-2">
        {templates.map((template) => {
          const active = selected === template.id;
          const done = applied === template.id;
          return (
            <li key={template.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setSelected(template.id)}
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition-colors",
                  active ? "border-blue-500 bg-blue-500/10" : "border-slate-700 bg-slate-800/50 hover:border-slate-500",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-white">{template.name}</span>
                  {template.description ? (
                    <span className="mt-1 line-clamp-2 block text-sm text-slate-400">{template.description}</span>
                  ) : null}
                  <span className="mt-2 block text-xs text-slate-500">{template.detail}</span>
                </span>
                {done ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                    <Check className="h-3 w-3" aria-hidden />
                    Uygulandı
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {manualHref ? (
          <Link href={manualHref} className="text-sm text-slate-400 hover:text-white hover:underline">
            {manualLabel}
          </Link>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button
            onClick={() => void handleApply()}
            disabled={!selected || pending}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Şablonu uygula
          </Button>
          <Button onClick={onNext} variant="outline" className="border-slate-600 bg-transparent">
            {applied ? "Devam" : "Atla"}
          </Button>
        </div>
      </div>
    </div>
  );
}
