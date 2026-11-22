"use client";

import { Check, ChevronLeft, ChevronRight, ClipboardList, FolderOpen, Layers, UserCog, UserPlus, Users } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TeamOrganizationData } from "../queries";
import { AssignmentsStep } from "./assignments-step";
import { ExtraStaffStep } from "./extra-staff-step";
import { GroupsStep } from "./groups-step";
import { createOrganizationStore, OrganizationStoreContext, useOrganization, WIZARD_STEPS, type WizardStepId } from "./store";
import { SummaryStep } from "./summary-step";
import { TeamsStep } from "./teams-step";
import { TemplatePanel } from "./template-panel";
import { TutorialDialog } from "./tutorial-dialog";

const STEP_ICONS: Record<WizardStepId, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  groups: Layers,
  teams: Users,
  assignments: UserCog,
  extra: UserPlus,
  summary: ClipboardList,
};

/** Ekip organizasyonu sihirbazı: her adım ayrı bileşen, taslak tek Zustand deposunda. */
export function TeamOrganizationWizard({ data }: { data: TeamOrganizationData }) {
  const [store] = useState(() => createOrganizationStore(data.organization));

  // Kayıt / şablon uygulama sonrası `router.refresh()` yeni sunucu verisi getirir: taslak yenilenir.
  useEffect(() => {
    store.getState().reset(data.organization);
  }, [store, data.organization]);

  return (
    <OrganizationStoreContext.Provider value={store}>
      <WizardBody data={data} />
    </OrganizationStoreContext.Provider>
  );
}

function Stepper({ current, onSelect }: { current: WizardStepId; onSelect: (id: WizardStepId) => void }) {
  const index = WIZARD_STEPS.findIndex((s) => s.id === current);
  return (
    <nav aria-label="Sihirbaz adımları">
      <ol className="flex items-start justify-center">
        {WIZARD_STEPS.map((s, i) => {
          const active = i === index;
          const done = i < index;
          const Icon = STEP_ICONS[s.id];
          return (
            <li key={s.id} className="flex items-start">
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={active ? "step" : undefined}
                className="flex w-20 flex-col items-center gap-1 text-center sm:w-32"
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full border-2 transition-all sm:size-12",
                    done ? "border-green-600 bg-green-600" : active ? "border-blue-600 bg-blue-600" : "border-slate-600 bg-slate-800",
                  )}
                >
                  {done ? (
                    <Check aria-hidden className="size-5 text-white" />
                  ) : (
                    <Icon aria-hidden className={cn("size-5", active ? "text-white" : "text-slate-400")} />
                  )}
                </span>
                <span className={cn("text-xs font-medium sm:text-sm", active ? "text-white" : "text-slate-400")}>
                  {i + 1}. {s.title}
                </span>
                <span className="hidden text-xs text-slate-500 lg:block">{s.description}</span>
              </button>
              {i < WIZARD_STEPS.length - 1 ? (
                <span aria-hidden className={cn("mt-5 h-0.5 w-4 sm:mt-6 sm:w-10", done ? "bg-green-600" : "bg-slate-700")} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function WizardBody({ data }: { data: TeamOrganizationData }) {
  const step = useOrganization((s) => s.step);
  const setStep = useOrganization((s) => s.setStep);
  const readOnly = !data.permissions.edit;
  const index = WIZARD_STEPS.findIndex((s) => s.id === step);
  const eventId = data.organization.event.id;
  const current = WIZARD_STEPS[index];

  return (
    <div className="space-y-6">
      <Stepper current={step} onSelect={setStep} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">{current?.title}</h2>
        <div className="flex flex-wrap gap-2">
          <TutorialDialog />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FolderOpen aria-hidden className="size-4" />
                Şablonlar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Organizasyon şablonları</DialogTitle>
                <DialogDescription>Kayıtlı bir şablonu uygulayın ya da son kaydedilmiş durumu şablon yapın.</DialogDescription>
              </DialogHeader>
              <TemplatePanel
                eventId={eventId}
                templates={data.templates}
                canApply={data.permissions.edit}
                canCreate={data.permissions.createTemplate}
                canDelete={data.permissions.deleteTemplate}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {step === "groups" ? <GroupsStep readOnly={readOnly} plan={data.plan} /> : null}
      {step === "teams" ? <TeamsStep readOnly={readOnly} /> : null}
      {step === "assignments" ? <AssignmentsStep readOnly={readOnly} /> : null}
      {step === "extra" ? <ExtraStaffStep readOnly={readOnly} /> : null}
      {step === "summary" ? <SummaryStep eventId={eventId} readOnly={readOnly} /> : null}

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={index <= 0}
          onClick={() => {
            const prev = WIZARD_STEPS[index - 1];
            if (prev) setStep(prev.id);
          }}
        >
          <ChevronLeft aria-hidden className="size-4" />
          Geri
        </Button>
        <Button
          disabled={index >= WIZARD_STEPS.length - 1}
          onClick={() => {
            const next = WIZARD_STEPS[index + 1];
            if (next) setStep(next.id);
          }}
        >
          İleri
          <ChevronRight aria-hidden className="size-4" />
        </Button>
      </div>
    </div>
  );
}
