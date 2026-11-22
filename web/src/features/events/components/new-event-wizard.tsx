"use client";

import { Calendar, Check, Layout, Mail, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { applyTemplateAction } from "@/features/staffing/actions";
import { applyVenueTemplateAction } from "@/features/venue/actions";
import { cn } from "@/lib/utils";
import type { WizardTemplate } from "../board";
import { EventForm } from "./event-form";
import { WizardTemplateStep, type ApplyOutcome } from "./wizard-template-step";

const STEPS = [
  { id: 1, title: "Temel Bilgiler", description: "Etkinlik adı, tarih ve tür", icon: Calendar },
  { id: 2, title: "Alan Şablonu", description: "Mekan yerleşim planı", icon: Layout },
  { id: 3, title: "Ekip Ataması", description: "Servis ekibi organizasyonu", icon: Users },
  { id: 4, title: "E-Davetiye", description: "Davetiye tasarımı ve gönderim", icon: Mail },
] as const;

type Props = {
  venueTemplates: WizardTemplate[];
  teamTemplates: WizardTemplate[];
  canApplyVenue: boolean;
  canApplyTeam: boolean;
  canInvite: boolean;
};

function Stepper({ current }: { current: number }) {
  return (
    <ol aria-label="Adımlar" className="mb-8 flex items-center justify-center">
      {STEPS.map((step, index) => {
        const active = current === step.id;
        const done = current > step.id;
        const Icon = step.icon;
        return (
          <li key={step.id} className="flex items-center" aria-current={active ? "step" : undefined}>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all",
                  done ? "border-green-600 bg-green-600" : active ? "border-blue-600 bg-blue-600" : "border-slate-600 bg-slate-800",
                )}
              >
                {done ? (
                  <Check className="h-6 w-6 text-white" aria-hidden />
                ) : (
                  <Icon className={cn("h-5 w-5", active ? "text-white" : "text-slate-400")} aria-hidden />
                )}
              </div>
              <div className="mt-2 text-center">
                <p className={cn("text-sm font-medium", active ? "text-white" : "text-slate-400")}>{step.title}</p>
                <p className="hidden text-xs text-slate-500 sm:block">{step.description}</p>
              </div>
            </div>
            {index < STEPS.length - 1 ? (
              <div className={cn("mx-2 h-0.5 w-10 sm:mx-4 sm:w-24", done ? "bg-green-600" : "bg-slate-700")} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Eski "yeni etkinlik" sihirbazı: temel bilgiler -> alan şablonu -> ekip ataması -> e-davetiye. */
export function NewEventWizard({ venueTemplates, teamTemplates, canApplyVenue, canApplyTeam, canInvite }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [eventId, setEventId] = useState<string | null>(null);

  async function applyVenue(templateId: string): Promise<ApplyOutcome> {
    if (!eventId) return { ok: false, message: "Önce etkinlik oluşturulmalı" };
    const res = await applyVenueTemplateAction({ eventId, templateId });
    if (!res.ok) return { ok: false, message: res.message };
    return { ok: true, message: `Alan şablonu uygulandı (${res.data.tables.length} masa, ${res.data.totalCapacity} kişi)` };
  }

  async function applyTeam(templateId: string): Promise<ApplyOutcome> {
    if (!eventId) return { ok: false, message: "Önce etkinlik oluşturulmalı" };
    const res = await applyTemplateAction({ eventId, templateId });
    if (!res.ok) return { ok: false, message: res.message };
    return { ok: true, message: `Ekip şablonu uygulandı (${res.data.teams} ekip, ${res.data.assignments} atama)` };
  }

  function finish() {
    if (!eventId) return;
    router.push(`/events/${eventId}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Stepper current={step} />
      <div className="mx-auto max-w-3xl rounded-xl border border-slate-700 bg-slate-800/50 p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">{STEPS[step - 1]?.title}</h2>
          {eventId ? (
            <Link href={`/events/${eventId}`} className="text-sm text-slate-400 hover:text-white hover:underline">
              Etkinliğe git
            </Link>
          ) : null}
        </div>

        {step === 1 ? (
          <EventForm
            onCancel={() => router.push("/events")}
            onSaved={(id) => {
              setEventId(id);
              setStep(2);
            }}
          />
        ) : null}

        {step === 2 && eventId ? (
          <WizardTemplateStep
            icon={<Layout aria-hidden />}
            templates={venueTemplates}
            canApply={canApplyVenue}
            apply={applyVenue}
            onNext={() => setStep(3)}
            emptyTitle="Uygulanabilir alan şablonu yok"
            emptyDescription="Yerleşimi etkinlik oluşturulduktan sonra düzenleyiciden de çizebilirsiniz."
            manualHref={`/events/${eventId}/venue`}
            manualLabel="Yerleşimi elle düzenle"
          />
        ) : null}

        {step === 3 && eventId ? (
          <WizardTemplateStep
            icon={<Users aria-hidden />}
            templates={teamTemplates}
            canApply={canApplyTeam}
            apply={applyTeam}
            onNext={() => setStep(4)}
            emptyTitle="Uygulanabilir ekip şablonu yok"
            emptyDescription="Ekibi etkinlik oluşturulduktan sonra ekip organizasyonu sayfasından kurabilirsiniz."
            manualHref={`/events/${eventId}/team-organization`}
            manualLabel="Ekibi elle düzenle"
          />
        ) : null}

        {step === 4 && eventId ? (
          <div className="space-y-6">
            <EmptyState
              icon={<Mail aria-hidden />}
              title="E-davetiye hazırlayın"
              description={
                canInvite
                  ? "Davetiye tasarımını ve gönderimini davetiye sayfasından yapabilirsiniz; şimdilik atlayıp sonra da dönebilirsiniz."
                  : "Davetiye sayfası için yetkiniz yok."
              }
              action={
                canInvite ? (
                  <Link
                    href={`/events/${eventId}/invitation`}
                    className={cn(buttonVariants({ variant: "outline" }), "border-slate-600 bg-transparent")}
                  >
                    Davetiye sayfasına git
                  </Link>
                ) : null
              }
            />
            <div className="flex justify-end">
              <Button onClick={finish} className="bg-emerald-600 text-white hover:bg-emerald-700">
                Bitir ve etkinliğe git
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
