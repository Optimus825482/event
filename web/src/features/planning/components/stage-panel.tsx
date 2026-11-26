"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { transitionStageAction } from "../actions";
import { actionButtons, historyLine, type ActionButton } from "../view-model";
import type { PlanningState } from "../stage-service";
import { RevertDialog } from "./revert-dialog";
import { StageStepper } from "./stage-stepper";

const HISTORY_SHOWN = 5;

/** Planlama aşaması paneli. `compact`: yalnızca adım çubuğu ve düğmeler. */
export function PlanningStagePanel({ state, compact = false }: { state: PlanningState; compact?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<ActionButton | null>(null);
  const [reverting, setReverting] = useState<ActionButton | null>(null);

  const buttons = actionButtons(state);
  const hasAdvance = buttons.some((b) => b.kind === "advance");

  function run(button: ActionButton, note?: string) {
    startTransition(async () => {
      const result = await transitionStageAction({
        eventId: state.eventId,
        expected: state.stage,
        kind: button.kind,
        ...(note ? { note } : {}),
      });
      setConfirming(null);
      setReverting(null);
      if (result.ok) {
        router.refresh();
        return;
      }
      toast.error(result.message);
      // Aşama başka biri tarafından değişmiş olabilir; güncel durumu göster.
      if (result.code === "conflict") router.refresh();
    });
  }

  function onClick(button: ActionButton) {
    if (button.needsNote) setReverting(button);
    else if (button.confirm) setConfirming(button);
    else run(button);
  }

  return (
    <section aria-label="Planlama aşaması" className="space-y-4 rounded-xl border border-slate-700 bg-slate-800 p-4">
      <StageStepper stage={state.stage} />

      {!compact && hasAdvance && state.blockers.length > 0 ? (
        <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          <p className="font-medium">Sonraki aşama için eksikler</p>
          <ul className="mt-1 list-disc pl-5">
            {state.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {buttons.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {buttons.map((b) => (
            <Button
              key={`${b.kind}-${b.to}`}
              type="button"
              variant={b.kind === "revert" ? "outline" : "default"}
              disabled={pending}
              onClick={() => onClick(b)}
            >
              {b.label}
            </Button>
          ))}
        </div>
      ) : null}

      {!compact && state.history.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-white">Son hareketler</h3>
          <ul className="space-y-1.5 text-sm text-slate-300">
            {state.history.slice(0, HISTORY_SHOWN).map((item) => {
              const line = historyLine(item);
              return (
                <li key={item.id}>
                  <span>{line.text}</span>
                  {line.note ? <span className="block text-xs text-slate-400">Neden: {line.note}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={confirming?.label ?? ""}
        description={confirming?.confirm ?? ""}
        variant="warning"
        loading={pending}
        onConfirm={() => confirming && run(confirming)}
      />
      <RevertDialog
        open={reverting !== null}
        onOpenChange={(open) => {
          if (!open) setReverting(null);
        }}
        pending={pending}
        onSubmit={(note) => reverting && run(reverting, note)}
      />
    </section>
  );
}
