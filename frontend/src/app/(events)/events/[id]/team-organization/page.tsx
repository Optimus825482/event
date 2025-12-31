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
  Step1TableGrouping,
  Step2TeamAssignment,
  Step5Summary,
  TutorialModal,
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
  const [canvasToolbar, setCanvasToolbar] = useState<CanvasToolbarState | null>(
    null
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
    addServicePoint,
    updateServicePoint,
    deleteServicePoint,
    assignStaffToServicePoint,
    removeStaffFromServicePoint,
    saveServicePointStaffAssignments,
  } = useOrganizationData(eventId);

  // Başlangıç step'ini hesapla - loading bitmeden önce URL'den al
  const validSteps: WizardStep[] = [
    "table-grouping",
    "team-assignment",
    "summary",
  ];
  const computedInitialStep: WizardStep =
    urlStep && validSteps.includes(urlStep) ? urlStep : "table-grouping";

  // Wizard State Hook - initialStep ile başlat
  const wizard = useWizardState({ initialStep: computedInitialStep });

  // Mevcut verileri yükle
  const [dataLoaded, setDataLoaded] = useState(false);

  // Veri yükleme effect'i
  useEffect(() => {
    if (dataLoaded || loading) return;

    const hasExistingData =
      existingGroups.length > 0 || existingTeams.length > 0;

    console.log("🔄 Team Organization Init:", {
      urlStep,
      computedInitialStep,
      hasExistingData,
      existingGroupsCount: existingGroups.length,
      existingTeamsCount: existingTeams.length,
      currentStep: wizard.currentStep,
    });

    if (hasExistingData) {
      // Mevcut veriyi yükle (step zaten hook'ta ayarlandı)
      wizard.loadFromTemplate(existingGroups, existingTeams);
    } else {
      // Veri yoksa initialized olarak işaretle
      wizard.setIsInitialized(true);
    }

    setDataLoaded(true);
  }, [loading, dataLoaded, existingGroups, existingTeams]);

  // Canvas toolbar'ı Step 1 ve Step 2'de göster
  const showCanvasToolbar =
    (wizard.currentStep === "table-grouping" ||
      wizard.currentStep === "team-assignment") &&
    canvasToolbar;

  // Kaydet
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const success = await saveOrganization(
        wizard.tableGroups,
        wizard.teams,
        extraStaffList
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
      case "table-grouping":
        return (
          <Step1TableGrouping
            tables={tables}
            tableGroups={wizard.tableGroups}
            teams={wizard.teams}
            stageElements={stageElements}
            allStaff={allStaff}
            extraStaffList={extraStaffList}
            workShifts={eventShifts}
            eventId={eventId}
            viewMode={viewMode}
            onAddGroup={wizard.addTableGroup}
            onUpdateGroup={wizard.updateTableGroup}
            onDeleteGroup={wizard.deleteTableGroup}
            onAddTablesToGroup={wizard.addTablesToGroup}
            onAddTeam={wizard.addTeam}
            onAssignGroupToTeam={wizard.assignGroupToTeam}
            onUnassignGroupFromTeam={wizard.unassignGroupFromTeam}
            onAssignStaffToGroup={wizard.assignStaffToGroup}
            onLoadFromTemplate={(groups, teams) => {
              // DEBUG: Gelen grupları logla
              console.log(
                "📥 page.tsx onLoadFromTemplate - Gelen gruplar:",
                groups.map((g) => ({
                  id: g.id,
                  name: g.name,
                  staffAssignmentsCount: g.staffAssignments?.length || 0,
                }))
              );

              // Mevcut grupları temizle ve yenilerini yükle
              wizard.clearAll();
              wizard.loadFromTemplate(groups, teams);
              wizard.setHasChanges(true);
            }}
            onCanvasStateChange={setCanvasToolbar}
            servicePoints={servicePoints}
            onAddServicePoint={async (data) => {
              const result = await addServicePoint(data);
              if (result) {
                wizard.setHasChanges(true);
              }
            }}
            onUpdateServicePoint={async (id, data) => {
              const result = await updateServicePoint(id, data);
              if (result) {
                wizard.setHasChanges(true);
              }
            }}
            onDeleteServicePoint={async (id) => {
              const result = await deleteServicePoint(id);
              if (result) {
                wizard.setHasChanges(true);
              }
            }}
            onSaveServicePointStaffAssignments={async (
              servicePointId,
              assignments
            ) => {
              const result = await saveServicePointStaffAssignments(
                servicePointId,
                assignments
              );
              if (result) {
                wizard.setHasChanges(true);
              }
              return result;
            }}
          />
        );
      case "team-assignment":
        return (
          <Step2TeamAssignment
            tables={tables}
            tableGroups={wizard.tableGroups}
            teams={wizard.teams}
            stageElements={stageElements}
            servicePoints={servicePoints}
            viewMode={viewMode}
            onAddTeam={wizard.addTeam}
            onUpdateTeam={wizard.updateTeam}
            onDeleteTeam={wizard.deleteTeam}
            onAssignGroupToTeam={wizard.assignGroupToTeam}
            onUnassignGroupFromTeam={wizard.unassignGroupFromTeam}
            onCanvasStateChange={setCanvasToolbar}
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
      </PageContainer>
    </TooltipProvider>
  );
}

// Helper: Tamamlanan adımları hesapla
function getCompletedSteps(
  wizard: ReturnType<typeof useWizardState>
): WizardStep[] {
  const completed: WizardStep[] = [];

  // Step 1: Masa grupları oluşturulmuş ve personel atanmış
  if (
    wizard.tableGroups.length > 0 &&
    wizard.tableGroups.some(
      (g) => g.staffAssignments && g.staffAssignments.length > 0
    )
  ) {
    completed.push("table-grouping");
  }

  // Step 2: Takımlar oluşturulmuş ve gruplar atanmış
  if (
    wizard.teams.length > 0 &&
    wizard.tableGroups.some((g) => g.assignedTeamId)
  ) {
    completed.push("team-assignment");
  }

  return completed;
}
