"use client";

import {
  Check,
  Grid3X3,
  Users,
  Link,
  UserPlus,
  CheckCircle,
} from "lucide-react";
import { WizardStep, WIZARD_STEPS } from "../types";
import { cn } from "@/lib/utils";

interface WizardStepperProps {
  currentStep: WizardStep;
  onStepClick: (step: WizardStep) => void;
  completedSteps?: WizardStep[];
}

const STEP_ICONS: Record<string, React.ElementType> = {
  Grid3X3,
  Users,
  Link,
  UserPlus,
  CheckCircle,
};

export function WizardStepper({
  currentStep,
  onStepClick,
  completedSteps = [],
}: WizardStepperProps) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {WIZARD_STEPS.map((step, index) => {
          const Icon = STEP_ICONS[step.icon] || CheckCircle;
          const isActive = step.id === currentStep;
          const isCompleted =
            completedSteps.includes(step.id) || index < currentIndex;
          const isClickable = index <= currentIndex || isCompleted;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step Circle */}
              <button
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  "relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                  isActive && "bg-purple-600 border-purple-600 text-white",
                  isCompleted &&
                    !isActive &&
                    "bg-emerald-600 border-emerald-600 text-white",
                  !isActive &&
                    !isCompleted &&
                    "bg-slate-800 border-slate-600 text-slate-400",
                  isClickable &&
                    !isActive &&
                    "hover:border-purple-500 cursor-pointer",
                  !isClickable && "cursor-not-allowed opacity-50"
                )}
              >
                {isCompleted && !isActive ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </button>

              {/* Step Info */}
              <div className="ml-3 hidden sm:block">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isActive && "text-white",
                    isCompleted && !isActive && "text-emerald-400",
                    !isActive && !isCompleted && "text-slate-400"
                  )}
                >
                  {step.title}
                </p>
                <p className="text-xs text-slate-500">{step.description}</p>
              </div>

              {/* Connector Line */}
              {index < WIZARD_STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4",
                    index < currentIndex ? "bg-emerald-600" : "bg-slate-700"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
