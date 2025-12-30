"use client";

import { memo, useState, useEffect, useCallback } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Grid3X3,
  UserPlus,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "team-org-tutorial-seen";

interface TutorialStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  tip?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    icon: <Grid3X3 className="w-8 h-8 text-purple-400" />,
    title: "1. Masa Grupları ve Ekipler",
    description:
      "Canvas üzerinde masaları seçerek gruplar oluşturun ve ekiplere atayın. Lasso aracıyla birden fazla masa seçebilir, sağ tık menüsüyle grup oluşturabilirsiniz.",
    tip: "💡 Sağ panelden yeni ekip oluşturup grupları sürükle-bırak ile atayabilirsiniz",
  },
  {
    icon: <UserPlus className="w-8 h-8 text-amber-400" />,
    title: "2. Personel Atama",
    description:
      "Her gruba personel atayın. Sol panelden personel seçip gruplara sürükleyebilir veya grup kartındaki '+' butonunu kullanabilirsiniz.",
    tip: "💡 Personeller pozisyonlarına göre filtrelenebilir",
  },
  {
    icon: <CheckCircle className="w-8 h-8 text-green-400" />,
    title: "3. Özet ve Kaydetme",
    description:
      "Tüm organizasyonu gözden geçirin. Eksik atamalar varsa uyarı gösterilir. Her şey tamamsa kaydedin!",
    tip: "💡 Değişiklikler otomatik olarak taslak kaydedilir",
  },
];

interface TutorialModalProps {
  forceShow?: boolean;
  onClose?: () => void;
}

export const TutorialModal = memo(function TutorialModal({
  forceShow = false,
  onClose,
}: TutorialModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // İlk girişte göster
  useEffect(() => {
    if (forceShow) {
      setIsOpen(true);
      return;
    }

    const hasSeenTutorial = localStorage.getItem(STORAGE_KEY);
    if (!hasSeenTutorial) {
      setIsOpen(true);
    }
  }, [forceShow]);

  const handleClose = useCallback(() => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    setIsOpen(false);
    setCurrentStep(0);
    onClose?.();
  }, [dontShowAgain, onClose]);

  const handleNext = useCallback(() => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleClose();
    }
  }, [currentStep, handleClose]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Ekip Organizasyonu Rehberi
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          {/* Step Content */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
              {step.icon}
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {step.title}
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              {step.description}
            </p>
            {step.tip && (
              <p className="text-xs text-purple-400 mt-3 bg-purple-500/10 rounded-lg px-3 py-2">
                {step.tip}
              </p>
            )}
          </div>

          {/* Step Indicators */}
          <div className="flex justify-center gap-2 mb-6">
            {TUTORIAL_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentStep
                    ? "w-6 bg-purple-500"
                    : index < currentStep
                    ? "bg-purple-500/50"
                    : "bg-slate-600"
                )}
              />
            ))}
          </div>

          {/* Don't show again checkbox */}
          <label className="flex items-center justify-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
            />
            Bir daha gösterme
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-slate-400 hover:text-white"
          >
            Atla
          </Button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handlePrev}
                className="border-slate-600"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Geri
              </Button>
            )}
            <Button
              onClick={handleNext}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isLastStep ? (
                "Başla"
              ) : (
                <>
                  İleri
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
