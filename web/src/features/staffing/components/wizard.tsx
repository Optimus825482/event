"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { TeamOrganizationData } from "../queries";
import { AssignmentsStep } from "./assignments-step";
import { ExtraStaffStep } from "./extra-staff-step";
import { GroupsStep } from "./groups-step";
import { createOrganizationStore, OrganizationStoreContext, useOrganization, WIZARD_STEPS } from "./store";
import { SummaryStep } from "./summary-step";
import { TeamsStep } from "./teams-step";
import { TemplatePanel } from "./template-panel";

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

function WizardBody({ data }: { data: TeamOrganizationData }) {
  const step = useOrganization((s) => s.step);
  const setStep = useOrganization((s) => s.setStep);
  const readOnly = !data.permissions.edit;
  const index = WIZARD_STEPS.findIndex((s) => s.id === step);
  const eventId = data.organization.event.id;

  return (
    <div className="space-y-6">
      <nav aria-label="Sihirbaz adımları">
        <ol className="grid gap-2 sm:grid-cols-5">
          {WIZARD_STEPS.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setStep(s.id)}
                aria-current={s.id === step ? "step" : undefined}
                className={`w-full rounded-md border p-2 text-left text-sm ${
                  s.id === step ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                }`}
              >
                <span className="block font-medium">
                  {i + 1}. {s.title}
                </span>
                <span className="block text-xs text-muted-foreground">{s.description}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {step === "groups" ? <GroupsStep readOnly={readOnly} /> : null}
      {step === "teams" ? <TeamsStep readOnly={readOnly} /> : null}
      {step === "assignments" ? <AssignmentsStep readOnly={readOnly} /> : null}
      {step === "extra" ? <ExtraStaffStep readOnly={readOnly} /> : null}
      {step === "summary" ? (
        <div className="space-y-4">
          <SummaryStep eventId={eventId} readOnly={readOnly} />
          <TemplatePanel
            eventId={eventId}
            templates={data.templates}
            canApply={data.permissions.edit}
            canCreate={data.permissions.createTemplate}
            canDelete={data.permissions.deleteTemplate}
          />
        </div>
      ) : null}

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={index <= 0}
          onClick={() => {
            const prev = WIZARD_STEPS[index - 1];
            if (prev) setStep(prev.id);
          }}
        >
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
        </Button>
      </div>
    </div>
  );
}
