"use client";

import { memo, useCallback, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  MousePointer2,
  Hand,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  AlertTriangle,
  Box,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WizardStep, WIZARD_STEPS } from "../types";
import { CanvasTool } from "../hooks/useCanvasInteraction";
import { cn } from "@/lib/utils";

interface CanvasToolbarProps {
  zoom: number;
  activeTool: CanvasTool;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToolChange: (tool: CanvasTool) => void;
  onSelectAll: () => void;
}

interface WizardNavigationProps {
  currentStep: WizardStep;
  canGoNext: boolean;
  canGoPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSave?: () => Promise<void>;
  isSaving?: boolean;
  hasChanges?: boolean;
  hasUnassignedGroups?: boolean;
  // Canvas toolbar props (optional - only for steps with canvas)
  canvasToolbar?: CanvasToolbarProps;
  // 3D view mode props
  viewMode?: "2d" | "3d";
  onViewModeChange?: (mode: "2d" | "3d") => void;
}

export const WizardNavigation = memo(function WizardNavigation({
  currentStep,
  canGoNext,
  canGoPrev,
  onNext,
  onPrev,
  onSave,
  isSaving = false,
  hasChanges = false,
  hasUnassignedGroups = false,
  canvasToolbar,
  viewMode = "2d",
  onViewModeChange,
}: WizardNavigationProps) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);
  const isLastStep = currentIndex === WIZARD_STEPS.length - 1;
  const isFirstStep = currentIndex === 0;
  const [showWarningModal, setShowWarningModal] = useState(false);

  const handleNext = useCallback(() => {
    if (!canGoNext) return;

    // Step 2'de (team-assignment) gruplar takıma atanmamışsa uyarı göster
    if (currentStep === "team-assignment" && hasUnassignedGroups) {
      setShowWarningModal(true);
      return;
    }

    onNext();
  }, [canGoNext, currentStep, hasUnassignedGroups, onNext]);

  const handlePrev = useCallback(() => {
    if (canGoPrev) onPrev();
  }, [canGoPrev, onPrev]);

  const handleSave = useCallback(async () => {
    if (onSave && hasChanges && !isSaving) {
      await onSave();
    }
  }, [onSave, hasChanges, isSaving]);

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
      {/* Sol: Geri Butonu + Canvas Toolbar */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={!canGoPrev || isFirstStep}
          className={cn(
            "border-slate-600 text-slate-300 hover:bg-slate-700",
            (!canGoPrev || isFirstStep) && "opacity-50 cursor-not-allowed"
          )}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Geri
        </Button>

        {/* Canvas Toolbar - Geri butonunun sağında */}
        {canvasToolbar && (
          <div className="flex items-center gap-1 bg-slate-900/50 rounded-lg px-2 py-1 border border-slate-700">
            {/* Tool Selector */}
            <Button
              size="icon"
              variant={
                canvasToolbar.activeTool === "select" ? "secondary" : "ghost"
              }
              className="h-7 w-7"
              onClick={() => canvasToolbar.onToolChange("select")}
              title="Seçim Aracı (Lasso)"
            >
              <MousePointer2 className="w-3.5 h-3.5" />
            </Button>

            <Button
              size="icon"
              variant={
                canvasToolbar.activeTool === "pan" ? "secondary" : "ghost"
              }
              className="h-7 w-7"
              onClick={() => canvasToolbar.onToolChange("pan")}
              title="Kaydırma Aracı"
            >
              <Hand className="w-3.5 h-3.5" />
            </Button>

            <div className="w-px h-5 bg-slate-600 mx-1" />

            {/* Zoom Controls */}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={canvasToolbar.onZoomOut}
              disabled={canvasToolbar.zoom <= 0.5}
              title="Uzaklaştır"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>

            <span className="text-[10px] text-slate-400 min-w-[32px] text-center">
              {Math.round(canvasToolbar.zoom * 100)}%
            </span>

            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={canvasToolbar.onZoomIn}
              disabled={canvasToolbar.zoom >= 2}
              title="Yakınlaştır"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={canvasToolbar.onResetView}
              title="Görünümü Sıfırla"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={canvasToolbar.onSelectAll}
              title="Tümünü Seç (Ctrl+A)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>

            {/* 3D Toggle Button */}
            {onViewModeChange && (
              <>
                <div className="w-px h-5 bg-slate-600 mx-1" />
                <Button
                  size="sm"
                  variant={viewMode === "3d" ? "secondary" : "ghost"}
                  className={cn(
                    "h-7 px-2",
                    viewMode === "3d"
                      ? "bg-cyan-600 text-white hover:bg-cyan-700"
                      : "text-cyan-400 hover:bg-cyan-500/20"
                  )}
                  onClick={() =>
                    onViewModeChange(viewMode === "2d" ? "3d" : "2d")
                  }
                  title={
                    viewMode === "2d" ? "3D Görünüme Geç" : "2D Görünüme Dön"
                  }
                >
                  <Box className="w-3.5 h-3.5 mr-1" />
                  {viewMode === "2d" ? "3D" : "2D"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Orta: Step bilgisi */}
      <div className="text-sm text-slate-400">
        Adım {currentIndex + 1} / {WIZARD_STEPS.length}
      </div>

      {/* Sağ: İleri veya Kaydet Butonu */}
      {isLastStep ? (
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={cn(
            "bg-emerald-600 hover:bg-emerald-700",
            (!hasChanges || isSaving) && "opacity-50 cursor-not-allowed"
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Kaydediliyor...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Kaydet
            </>
          )}
        </Button>
      ) : (
        <Button
          onClick={handleNext}
          disabled={!canGoNext}
          className={cn(
            "bg-purple-600 hover:bg-purple-700",
            !canGoNext && "opacity-50 cursor-not-allowed"
          )}
        >
          İleri
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      )}

      {/* Uyarı Modalı - Gruplar takıma atanmamış */}
      <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Grupları Takımlara Atamalısınız
            </DialogTitle>
            <DialogDescription className="text-slate-300 pt-2">
              Bir sonraki adımda personelleri{" "}
              <strong className="text-white">takımlara</strong> atayacaksınız.
              Bunun için önce masa gruplarınızı takımlara atamanız gerekiyor.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
            <p className="text-sm text-slate-400">
              💡 <span className="text-slate-300">Nasıl yapılır:</span> Sol
              paneldeki grupları sağ tıklayarak veya sürükleyerek takımlara
              atayabilirsiniz.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowWarningModal(false)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              Anladım
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
