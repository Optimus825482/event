"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  UsersRound,
  ArrowLeft,
  Calendar,
  Clock,
  Save,
  Loader2,
  RotateCcw,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageContainer } from "@/components/ui/PageContainer";

// Toast için basit alert kullanıyoruz (sonner yoksa)
const toast = {
  success: (msg: string) => console.log("✅", msg),
  error: (msg: string) => console.error("❌", msg),
  info: (msg: string) => console.log("ℹ️", msg),
};

// Wizard Components
import {
  WizardStepper,
  WizardNavigation,
  Step2TeamAssignment,
  StaffAssignmentStep,
  Step5Summary,
  TutorialModal,
  TemplateLoadModal,
} from "./components";

// Hooks
import { useWizardState, useOrganizationData } from "./hooks";
import type { CanvasTool } from "./hooks";

// Types
import { WizardStep, Staff } from "./types";

// Canvas toolbar state type
interface CanvasToolbarState {
  zoom: number;
  activeTool: CanvasTool;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToolChange: (tool: CanvasTool) => void;
  onSelectAll: () => void;
}

export default function TeamOrganizationPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = params.id as string;

  const [saving, setSaving] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [canvasToolbar, setCanvasToolbar] = useState<CanvasToolbarState | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");

  // URL'den başlangıç step'ini al
  const urlStep = searchParams.get("step") as WizardStep | null;

  // Data Hook
  const {
    event,
    tables,
    stageElements,
    allStaff,
    eventShifts,
    existingGroups,
    existingTeams,
    servicePoints,
    extraStaffList,
    loading,
    error,
    saveOrganization,
    setExtraStaffList,
    reload: reloadData,
    addServicePoint,
    updateServicePoint,
    deleteServicePoint,
    assignStaffToServicePoint,
    removeStaffFromServicePoint,
    saveServicePointStaffAssignments,
  } = useOrganizationData(eventId);

  // Başlangıç step'ini hesapla - loading bitmeden önce URL'den al
  const validSteps: WizardStep[] = [
    "team-assignment",
    "staff-assignment",
    "summary",
  ];
  const computedInitialStep: WizardStep =
    urlStep && validSteps.includes(urlStep) ? urlStep : "team-assignment";

  // Wizard State Hook - initialStep ile başlat
  const wizard = useWizardState({ initialStep: computedInitialStep });

  // Mevcut verileri yükle
  const [dataLoaded, setDataLoaded] = useState(false);

  // Veri yükleme effect'i
  useEffect(() => {
    if (dataLoaded || loading) return;

    const hasExistingData =
      existingGroups.length > 0 || existingTeams.length > 0;

    if (hasExistingData) {
      // Mevcut veriyi yükle (step zaten hook'ta ayarlandı)
      wizard.loadFromTemplate(existingGroups, existingTeams);
    } else {
      // Veri yoksa initialized olarak işaretle
      wizard.setIsInitialized(true);
    }

    setDataLoaded(true);
  }, [loading, dataLoaded, existingGroups, existingTeams]);

  // Canvas toolbar'ı Step 1'de göster
  const showCanvasToolbar =
    wizard.currentStep === "team-assignment" && canvasToolbar;

  // Kaydet
  const handleSave = useCallback(async () => {
    setSaving(true);
    const staffCount = wizard.tableGroups.reduce((sum, g) => sum + (g.staffAssignments?.length || 0), 0);
    console.log("💾 handleSave:", { groups: wizard.tableGroups.length, teams: wizard.teams.length, staffAssignments: staffCount });
    try {
      const success = await saveOrganization(
        wizard.tableGroups,
        wizard.teams,
        extraStaffList,
      );
      if (success) {
        toast.success("Organizasyon kaydedildi");
        wizard.setHasChanges(false);
      } else {
        toast.error("Kaydetme başarısız");
      }
    } catch (err) {
      toast.error("Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  }, [saveOrganization, wizard, extraStaffList]);

  // Sıfırla
  const handleReset = useCallback(() => {
    if (confirm("Tüm değişiklikler silinecek. Emin misiniz?")) {
      wizard.clearAll();
      toast.info("Organizasyon sıfırlandı");
    }
  }, [wizard]);

  // Loading state
  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg bg-slate-700" />
            <div>
              <Skeleton className="h-6 w-48 bg-slate-700 mb-2" />
              <Skeleton className="h-4 w-32 bg-slate-700" />
            </div>
          </div>
          <Skeleton className="h-[600px] w-full bg-slate-700" />
        </div>
      </PageContainer>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <UsersRound className="w-16 h-16 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 mb-4">
            {error || "Etkinlik bulunamadı"}
          </p>
          <Button asChild>
            <Link href="/staff">Ekip Yönetimine Dön</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  // Alan planı yok
  if (tables.length === 0) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/staff")}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">{event.name}</h1>
              <p className="text-sm text-slate-400">Ekip Organizasyonu</p>
            </div>
          </div>

          <div className="text-center py-16 bg-slate-800/50 rounded-xl border border-slate-700">
            <UsersRound className="w-16 h-16 mx-auto text-slate-600 mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">
              Alan Planı Bulunamadı
            </h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Ekip organizasyonu yapabilmek için önce etkinliğin alan planını
              oluşturmanız gerekiyor.
            </p>
            <Button asChild className="bg-purple-600">
              <Link href={`/events/${eventId}/venue`}>Alan Planı Oluştur</Link>
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Render current step
  const renderStep = () => {
    switch (wizard.currentStep) {
      case "team-assignment":
        return (
          <Step2TeamAssignment
            tables={tables}
            tableGroups={wizard.tableGroups}
            teams={wizard.teams}
            stageElements={stageElements}
            servicePoints={servicePoints}
            allStaff={allStaff}
            viewMode={viewMode}
            eventId={eventId}
            onAddTeam={wizard.addTeam}
            onUpdateTeam={wizard.updateTeam}
            onDeleteTeam={wizard.deleteTeam}
            onAddTableGroup={wizard.addTableGroup}
            onDeleteTableGroup={wizard.deleteTableGroup}
            onAssignGroupToTeam={wizard.assignGroupToTeam}
            onUnassignGroupFromTeam={wizard.unassignGroupFromTeam}
            onAssignStaffToGroup={wizard.assignStaffToGroup}
            onCanvasStateChange={setCanvasToolbar}
            setExtraStaffList={setExtraStaffList}
            onStaffCreated={reloadData}
          />
        );
      case "staff-assignment":
        return (
          <StaffAssignmentStep
            tables={tables}
            tableGroups={wizard.tableGroups}
            allStaff={allStaff}
            onUpdateTableGroup={wizard.updateTableGroup}
            onAssignStaffToGroup={wizard.assignStaffToGroup}
            onRemoveStaffFromGroup={wizard.removeStaffFromGroup}
            onUpdateStaffAssignment={wizard.updateStaffAssignment}
            onAddTableGroup={wizard.addTableGroup}
          />
        );
      case "summary":
        return (
          <Step5Summary
            tableGroups={wizard.tableGroups}
            teams={wizard.teams}
            allStaff={[...allStaff, ...extraStaffList] as Staff[]}
            tables={tables}
            servicePoints={servicePoints}
            extraStaff={extraStaffList}
            eventId={eventId}
            eventName={event?.name}
            eventDate={event?.eventDate}
          />
        );
      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <PageContainer>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-6">
              <h1 className="text-base font-semibold text-white">
                {event.name}
              </h1>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {new Date(event.eventDate).toLocaleDateString("tr-TR")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {new Date(event.eventDate).toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowTemplateModal(true)}
                className="border-purple-600 text-purple-400 hover:bg-purple-600/10"
              >
                <FileText className="w-4 h-4 mr-2" />
                Şablondan Yükle
              </Button>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="border-emerald-600 text-emerald-400 hover:bg-emerald-600/10"
              >
                <Link href={`/events/${eventId}/excel-import`}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel'den Yükle
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReset}
                disabled={!wizard.hasChanges || saving}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Sıfırla
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!wizard.hasChanges || saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Kaydet
              </Button>
            </div>
          </div>

          {/* Wizard Stepper */}
          <WizardStepper
            currentStep={wizard.currentStep}
            onStepClick={wizard.goToStep}
            completedSteps={getCompletedSteps(wizard)}
          />

          {/* Navigation - Canvas üstünde, toolbar ile */}
          <div className="my-3">
            <WizardNavigation
              currentStep={wizard.currentStep}
              canGoNext={wizard.canGoNext}
              canGoPrev={wizard.canGoPrev}
              onNext={wizard.goNext}
              onPrev={wizard.goPrev}
              onSave={handleSave}
              isSaving={saving}
              hasChanges={wizard.hasChanges}
              hasUnassignedGroups={wizard.hasUnassignedGroups}
              canvasToolbar={showCanvasToolbar ? canvasToolbar : undefined}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </div>

          {/* Step Content */}
          <div className="flex-1 bg-slate-800/50 rounded-xl border border-slate-700 p-4 overflow-hidden">
            {renderStep()}
          </div>
        </div>

        {/* Tutorial Modal - İlk girişte gösterilir */}
        <TutorialModal />

        {/* Template Load Modal */}
        <TemplateLoadModal
          open={showTemplateModal}
          onOpenChange={setShowTemplateModal}
          eventId={eventId}
          onTemplateApplied={() => {
            setDataLoaded(false);
            reloadData();
          }}
        />
      </PageContainer>
    </TooltipProvider>
  );
}

// Helper: Tamamlanan adımları hesapla
function getCompletedSteps(
  wizard: ReturnType<typeof useWizardState>,
): WizardStep[] {
  const completed: WizardStep[] = [];

  // Step 1: En az 1 personel ataması yapılmış
  if (wizard.tableGroups.some((g) => (g.staffAssignments?.length || 0) > 0)) {
    completed.push("team-assignment");
  }

  // Step 2: En az bir gruba personel atanmış
  if (wizard.tableGroups.some((g) => (g.staffAssignments?.length || 0) > 0)) {
    completed.push("staff-assignment");
  }

  return completed;
}
