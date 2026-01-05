"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Users,
  Table2,
  Clock,
  Loader2,
  Save,
  Trash2,
  Sparkles,
  X,
  ChevronDown,
  ChevronRight,
  UserCheck,
  UserX,
  MapPin,
  Shield,
  Crown,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

// Tip tanımlamaları
interface ParsedStaffAssignment {
  staffName: string;
  staffId?: string;
  tableIds: string[];
  shiftStart: string;
  shiftEnd: string;
  groupName: string;
  groupColor: string;
  assignmentType: "table" | "loca" | "bar" | "special";
  matchConfidence: number;
  matchedStaff?: { id: string; fullName: string };
  warnings?: string[];
}

interface ParsedGroup {
  name: string;
  color: string;
  tableIds: string[];
  groupType: "standard" | "loca";
  assignments: ParsedStaffAssignment[];
}

interface ParsedServicePointAssignment {
  staffName: string;
  staffId?: string;
  shiftStart: string;
  shiftEnd: string;
  matchConfidence: number;
  matchedStaff?: { id: string; fullName: string };
}

interface ParsedServicePoint {
  name: string;
  pointType: "bar" | "depo" | "fuaye" | "casino" | "other";
  color: string;
  assignments: ParsedServicePointAssignment[];
}

interface ParsedExtraPersonnel {
  staffName: string;
  tableIds: string[];
  shiftStart: string;
  shiftEnd: string;
  isBackground?: boolean;
}

interface ParsedSupportTeamMember {
  staffName: string;
  position: string;
  assignment: string;
  tableIds: string[];
  shiftStart: string;
  shiftEnd: string;
  isNotComing?: boolean;
}

interface ParsedSupportTeam {
  name: string;
  color: string;
  members: ParsedSupportTeamMember[];
}

interface ParsedCaptain {
  staffName: string;
  staffId?: string;
  position: "CAPTAIN" | "J. CAPTAIN" | "INCHARGE";
  shiftStart: string;
  shiftEnd: string;
  area?: string;
  matchConfidence: number;
  matchedStaff?: { id: string; fullName: string };
}

interface ParsedSupervisor {
  staffName: string;
  staffId?: string;
  position: "SPVR";
  shiftStart: string;
  shiftEnd: string;
  area?: string;
  matchConfidence: number;
  matchedStaff?: { id: string; fullName: string };
}

interface ParsedLocaCaptain {
  staffName: string;
  staffId?: string;
  shiftStart: string;
  shiftEnd: string;
  area?: string;
  matchConfidence: number;
  matchedStaff?: { id: string; fullName: string };
}

interface AnalysisResult {
  eventId: string;
  eventName?: string;
  totalGroups: number;
  totalAssignments: number;
  groups: ParsedGroup[];
  servicePoints: ParsedServicePoint[];
  extraPersonnel: ParsedExtraPersonnel[];
  supportTeams: ParsedSupportTeam[];
  captains: ParsedCaptain[];
  supervisors: ParsedSupervisor[];
  locaCaptains: ParsedLocaCaptain[];
  unmatchedStaff: string[];
  warnings: string[];
  aiParsed?: boolean;
  summary: {
    tableGroups: number;
    locaGroups: number;
    servicePoints: number;
    extraPersonnel: number;
    supportTeamMembers: number;
    captains: number;
    supervisors: number;
    locaCaptains: number;
    matchedStaff: number;
    unmatchedStaff: number;
  };
}

interface ExcelPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onImportComplete: (groups: ParsedGroup[]) => void;
}

// Collapsible Section Component
function CollapsibleSection({
  title,
  icon: Icon,
  count,
  color,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  color: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className="rounded-lg overflow-hidden"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <CollapsibleTrigger
          className={cn(
            "w-full flex items-center justify-between p-3 border-y border-r transition-all cursor-pointer text-left",
            "hover:bg-slate-800/80",
            isOpen
              ? "bg-slate-800 border-slate-600"
              : "bg-slate-800/50 border-slate-700"
          )}
        >
          <div className="flex items-center gap-3">
            <span style={{ color: color as React.CSSProperties["color"] }}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="font-medium text-white">{title}</span>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: `${color}20`,
                color: color as React.CSSProperties["color"],
              }}
            >
              {count}
            </span>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="mt-2 ml-4 pl-4 border-l-2 border-slate-700">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Staff Match Badge Component
function StaffMatchBadge({
  matched,
  confidence,
}: {
  matched: boolean;
  confidence?: number;
}) {
  if (matched) {
    return (
      <div className="flex items-center gap-1">
        <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
        {confidence !== undefined && (
          <span className="text-xs text-emerald-400">%{confidence}</span>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <UserX className="h-3.5 w-3.5 text-red-400" />
      <span className="text-xs text-red-400">Eşleşmedi</span>
    </div>
  );
}

export function ExcelPreviewModal({
  isOpen,
  onClose,
  eventId,
  onImportComplete,
}: ExcelPreviewModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [clearExisting, setClearExisting] = useState(true);

  // Dosya yüklendiğinde otomatik analiz
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const selectedFile = acceptedFiles[0];
        setFile(selectedFile);
        setAnalysisResult(null);

        // Otomatik analiz başlat
        setIsAnalyzing(true);
        try {
          const formData = new FormData();
          formData.append("file", selectedFile);

          const response = await api.post<AnalysisResult>(
            `/excel-import/analyze/${eventId}`,
            formData,
            { headers: { "Content-Type": "multipart/form-data" } }
          );

          setAnalysisResult(response.data);
        } catch (error: any) {
          console.error("Analiz hatası:", error);
          const message =
            error.response?.data?.message ||
            error.message ||
            "Excel analiz edilemedi";
          alert(message);
          setFile(null);
        } finally {
          setIsAnalyzing(false);
        }
      }
    },
    [eventId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  // Onaylayıp kaydet
  const handleConfirmSave = async () => {
    if (!analysisResult) return;

    setIsSaving(true);
    try {
      await api.post(`/excel-import/confirm/${eventId}`, {
        analysisResult,
        options: { clearExisting },
      });

      onImportComplete(analysisResult.groups);
      handleClose();
    } catch (error: any) {
      console.error("Kaydetme hatası:", error);
      const message =
        error.response?.data?.message ||
        error.message ||
        "Veriler kaydedilemedi";
      alert(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setAnalysisResult(null);
    onClose();
  };

  // Toplam personel sayısı
  const getTotalPersonnel = () => {
    if (!analysisResult) return 0;
    return (
      analysisResult.groups.reduce((sum, g) => sum + g.assignments.length, 0) +
      (analysisResult.servicePoints?.reduce(
        (sum, sp) => sum + sp.assignments.length,
        0
      ) || 0) +
      (analysisResult.extraPersonnel?.length || 0) +
      (analysisResult.supportTeams?.reduce(
        (sum, t) => sum + t.members.length,
        0
      ) || 0) +
      (analysisResult.captains?.length || 0) +
      (analysisResult.supervisors?.length || 0) +
      (analysisResult.locaCaptains?.length || 0)
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden bg-slate-900 border-slate-700 p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Excel Önizleme</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Excel Önizleme
              </h2>
              {file && (
                <p className="text-sm text-slate-400">
                  {file.name} • {(file.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
            {analysisResult?.aiParsed && (
              <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Destekli
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-col h-[calc(95vh-140px)]">
          {/* Dosya Yükleme veya Analiz Sonucu */}
          {!analysisResult && !isAnalyzing ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div
                {...getRootProps()}
                className={cn(
                  "w-full max-w-xl border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all",
                  isDragActive
                    ? "border-emerald-500 bg-emerald-500/10 scale-[1.02]"
                    : "border-slate-600 hover:border-emerald-500/50 hover:bg-slate-800/50"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-16 w-16 text-slate-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-slate-300 mb-2">
                  Excel dosyasını sürükleyip bırakın
                </p>
                <p className="text-sm text-slate-500">
                  veya tıklayarak seçin (.xlsx, .xls)
                </p>
              </div>
            </div>
          ) : isAnalyzing ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-12 w-12 text-emerald-400 animate-spin mx-auto mb-4" />
                <p className="text-lg text-white mb-2">
                  Excel Analiz Ediliyor...
                </p>
                <p className="text-sm text-slate-400">
                  Personel eşleştirmeleri yapılıyor
                </p>
              </div>
            </div>
          ) : analysisResult ? (
            <>
              {/* Özet Kartları */}
              <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/30">
                <div className="grid grid-cols-8 gap-3">
                  <SummaryCard
                    icon={Users}
                    label="Toplam Personel"
                    value={getTotalPersonnel()}
                    color="#10b981"
                  />
                  <SummaryCard
                    icon={Table2}
                    label="Masa Grubu"
                    value={analysisResult.summary.tableGroups}
                    color="#3b82f6"
                  />
                  <SummaryCard
                    icon={Star}
                    label="Loca"
                    value={analysisResult.summary.locaGroups}
                    color="#a855f7"
                  />
                  <SummaryCard
                    icon={MapPin}
                    label="Hizmet Nok."
                    value={analysisResult.summary.servicePoints || 0}
                    color="#06b6d4"
                  />
                  <SummaryCard
                    icon={Crown}
                    label="Kaptan"
                    value={analysisResult.summary.captains || 0}
                    color="#84cc16"
                  />
                  <SummaryCard
                    icon={Shield}
                    label="Süpervizör"
                    value={analysisResult.summary.supervisors || 0}
                    color="#f97316"
                  />
                  <SummaryCard
                    icon={UserCheck}
                    label="Eşleşen"
                    value={analysisResult.summary.matchedStaff}
                    color="#22c55e"
                  />
                  <SummaryCard
                    icon={UserX}
                    label="Eşleşmeyen"
                    value={analysisResult.summary.unmatchedStaff}
                    color="#ef4444"
                  />
                </div>
              </div>

              {/* Ana İçerik - Collapsible Sections */}
              <ScrollArea className="flex-1 px-6 py-4">
                <div className="space-y-3 pb-4">
                  {/* Masa Grupları */}
                  {analysisResult.groups.filter(
                    (g) => g.groupType === "standard"
                  ).length > 0 && (
                    <CollapsibleSection
                      title="Masa Grupları"
                      icon={Table2}
                      count={analysisResult.summary.tableGroups}
                      color="#3b82f6"
                      defaultOpen={true}
                    >
                      <div className="grid grid-cols-2 gap-3 py-2">
                        {analysisResult.groups
                          .filter((g) => g.groupType === "standard")
                          .map((group) => (
                            <GroupCard key={group.name} group={group} />
                          ))}
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* Loca Grupları */}
                  {analysisResult.groups.filter((g) => g.groupType === "loca")
                    .length > 0 && (
                    <CollapsibleSection
                      title="Loca Grupları"
                      icon={Star}
                      count={analysisResult.summary.locaGroups}
                      color="#a855f7"
                      defaultOpen={true}
                    >
                      <div className="grid grid-cols-2 gap-3 py-2">
                        {analysisResult.groups
                          .filter((g) => g.groupType === "loca")
                          .map((group) => (
                            <GroupCard key={group.name} group={group} />
                          ))}
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* Hizmet Noktaları */}
                  {analysisResult.servicePoints &&
                    analysisResult.servicePoints.length > 0 && (
                      <CollapsibleSection
                        title="Hizmet Noktaları"
                        icon={MapPin}
                        count={analysisResult.servicePoints.length}
                        color="#06b6d4"
                      >
                        <div className="space-y-3 py-2">
                          {analysisResult.servicePoints.map((sp, idx) => (
                            <ServicePointCard key={idx} servicePoint={sp} />
                          ))}
                        </div>
                      </CollapsibleSection>
                    )}

                  {/* Kaptanlar */}
                  {analysisResult.captains &&
                    analysisResult.captains.length > 0 && (
                      <CollapsibleSection
                        title="Takım Kaptanları"
                        icon={Crown}
                        count={analysisResult.captains.length}
                        color="#84cc16"
                      >
                        <div className="grid grid-cols-3 gap-2 py-2">
                          {analysisResult.captains.map((captain, idx) => (
                            <PersonnelCard
                              key={idx}
                              name={captain.staffName}
                              position={captain.position}
                              shift={`${captain.shiftStart}-${captain.shiftEnd}`}
                              area={captain.area}
                              matched={!!captain.matchedStaff}
                              confidence={captain.matchConfidence}
                              color="#84cc16"
                            />
                          ))}
                        </div>
                      </CollapsibleSection>
                    )}

                  {/* Süpervizörler */}
                  {analysisResult.supervisors &&
                    analysisResult.supervisors.length > 0 && (
                      <CollapsibleSection
                        title="Süpervizörler"
                        icon={Shield}
                        count={analysisResult.supervisors.length}
                        color="#f97316"
                      >
                        <div className="grid grid-cols-3 gap-2 py-2">
                          {analysisResult.supervisors.map((supervisor, idx) => (
                            <PersonnelCard
                              key={idx}
                              name={supervisor.staffName}
                              position="SPVR"
                              shift={`${supervisor.shiftStart}-${supervisor.shiftEnd}`}
                              area={supervisor.area}
                              matched={!!supervisor.matchedStaff}
                              confidence={supervisor.matchConfidence}
                              color="#f97316"
                            />
                          ))}
                        </div>
                      </CollapsibleSection>
                    )}

                  {/* Loca Kaptanları */}
                  {analysisResult.locaCaptains &&
                    analysisResult.locaCaptains.length > 0 && (
                      <CollapsibleSection
                        title="Loca Kaptanları"
                        icon={Crown}
                        count={analysisResult.locaCaptains.length}
                        color="#ec4899"
                      >
                        <div className="grid grid-cols-3 gap-2 py-2">
                          {analysisResult.locaCaptains.map((lc, idx) => (
                            <PersonnelCard
                              key={idx}
                              name={lc.staffName}
                              position="LOCA KPT"
                              shift={`${lc.shiftStart}-${lc.shiftEnd}`}
                              area={lc.area}
                              matched={!!lc.matchedStaff}
                              confidence={lc.matchConfidence}
                              color="#ec4899"
                            />
                          ))}
                        </div>
                      </CollapsibleSection>
                    )}

                  {/* Destek Ekipleri */}
                  {analysisResult.supportTeams &&
                    analysisResult.supportTeams.length > 0 && (
                      <CollapsibleSection
                        title="Destek Ekipleri"
                        icon={Users}
                        count={analysisResult.summary.supportTeamMembers || 0}
                        color="#22c55e"
                      >
                        <div className="space-y-3 py-2">
                          {analysisResult.supportTeams.map((team, idx) => (
                            <SupportTeamCard key={idx} team={team} />
                          ))}
                        </div>
                      </CollapsibleSection>
                    )}

                  {/* Extra Personel */}
                  {analysisResult.extraPersonnel &&
                    analysisResult.extraPersonnel.length > 0 && (
                      <CollapsibleSection
                        title="Extra Personel"
                        icon={Users}
                        count={analysisResult.extraPersonnel.length}
                        color="#eab308"
                      >
                        <div className="grid grid-cols-3 gap-2 py-2">
                          {analysisResult.extraPersonnel.map((person, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded-lg bg-slate-800/50 border border-slate-700"
                            >
                              <p className="font-medium text-white text-sm">
                                {person.staffName}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                <Clock className="h-3 w-3" />
                                {person.shiftStart}-{person.shiftEnd}
                                {person.tableIds.length > 0 && (
                                  <span className="text-slate-500">
                                    • {person.tableIds.join(", ")}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleSection>
                    )}

                  {/* Eşleşmeyenler */}
                  {analysisResult.unmatchedStaff.length > 0 && (
                    <CollapsibleSection
                      title="Eşleşmeyen Personeller"
                      icon={AlertTriangle}
                      count={analysisResult.unmatchedStaff.length}
                      color="#ef4444"
                    >
                      <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30 my-2">
                        <p className="text-sm text-red-300/80 mb-3">
                          Bu personeller sistemde bulunamadı. İçe aktarıldığında
                          "Extra Personel" olarak eklenecekler.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {analysisResult.unmatchedStaff.map((name, idx) => (
                            <Badge
                              key={idx}
                              className="bg-red-500/20 text-red-400 border-red-500/30"
                            >
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* Uyarılar */}
                  {analysisResult.warnings &&
                    analysisResult.warnings.length > 0 && (
                      <CollapsibleSection
                        title="Uyarılar"
                        icon={AlertTriangle}
                        count={analysisResult.warnings.length}
                        color="#f59e0b"
                      >
                        <div className="space-y-1 py-2">
                          {analysisResult.warnings.map((warning, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2 text-sm text-amber-400/80"
                            >
                              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              {warning}
                            </div>
                          ))}
                        </div>
                      </CollapsibleSection>
                    )}
                </div>
              </ScrollArea>
            </>
          ) : null}

          {/* Footer */}
          {analysisResult && (
            <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="clearExisting"
                      checked={clearExisting}
                      onCheckedChange={(checked) =>
                        setClearExisting(checked as boolean)
                      }
                      className="border-slate-600"
                    />
                    <label
                      htmlFor="clearExisting"
                      className="text-sm text-slate-400"
                    >
                      Mevcut grupları temizle
                    </label>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setAnalysisResult(null);
                    }}
                    className="border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Temizle
                  </Button>
                  <Button
                    onClick={handleConfirmSave}
                    disabled={isSaving}
                    className="bg-emerald-600 hover:bg-emerald-700 px-6"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Kaydediliyor...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Onayla ve Uygula
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Summary Card Component
function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
      <div className="flex items-center gap-2">
        <span style={{ color: color as React.CSSProperties["color"] }}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-lg font-bold text-white">{value}</p>
          <p className="text-xs text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Group Card Component
function GroupCard({ group }: { group: ParsedGroup }) {
  return (
    <div
      className="p-3 rounded-lg bg-slate-800/50 border border-slate-700"
      style={{ borderLeftColor: group.color, borderLeftWidth: 4 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-white">{group.name}</span>
        <Badge className="text-xs bg-slate-700 text-slate-300">
          {group.assignments.length} kişi
        </Badge>
      </div>
      <p className="text-xs text-slate-400 mb-2">
        Masalar: {group.tableIds.join(", ")}
      </p>
      <div className="space-y-1">
        {group.assignments.map((a, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-xs py-1 border-t border-slate-700/50"
          >
            <span className="text-slate-300">{a.staffName}</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">
                {a.shiftStart}-{a.shiftEnd}
              </span>
              <StaffMatchBadge
                matched={!!a.matchedStaff}
                confidence={a.matchConfidence}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Service Point Card Component
function ServicePointCard({
  servicePoint,
}: {
  servicePoint: ParsedServicePoint;
}) {
  const badgeStyle: React.CSSProperties = {
    backgroundColor: `${servicePoint.color}20`,
    color: servicePoint.color,
  };

  return (
    <div
      className="p-3 rounded-lg bg-slate-800/50 border border-slate-700"
      style={{ borderLeftColor: servicePoint.color, borderLeftWidth: 4 }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{servicePoint.name}</span>
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={badgeStyle}
          >
            {servicePoint.pointType.toUpperCase()}
          </span>
        </div>
        <Badge className="text-xs bg-slate-700 text-slate-300">
          {servicePoint.assignments.length} kişi
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {servicePoint.assignments.map((a, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-xs p-2 bg-slate-900/50 rounded"
          >
            <span className="text-slate-300">{a.staffName}</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">
                {a.shiftStart}-{a.shiftEnd}
              </span>
              <StaffMatchBadge
                matched={!!a.matchedStaff}
                confidence={a.matchConfidence}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Support Team Card Component
function SupportTeamCard({ team }: { team: ParsedSupportTeam }) {
  return (
    <div
      className="p-3 rounded-lg bg-slate-800/50 border border-slate-700"
      style={{ borderLeftColor: team.color, borderLeftWidth: 4 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-white">{team.name}</span>
        <Badge className="text-xs bg-slate-700 text-slate-300">
          {team.members.length} kişi
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {team.members.map((m, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-xs p-2 bg-slate-900/50 rounded"
          >
            <div>
              <span className="text-slate-300">{m.staffName}</span>
              <Badge
                className={cn(
                  "ml-2 text-[10px]",
                  m.position === "SPVR" && "bg-red-500/20 text-red-400",
                  m.position === "CAPTAIN" &&
                    "bg-orange-500/20 text-orange-400",
                  m.position === "PERSONEL" && "bg-blue-500/20 text-blue-400"
                )}
              >
                {m.position}
              </Badge>
            </div>
            <span className="text-slate-500">
              {m.shiftStart}-{m.shiftEnd}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Personnel Card Component
function PersonnelCard({
  name,
  position,
  shift,
  area,
  matched,
  confidence,
  color,
}: {
  name: string;
  position: string;
  shift: string;
  area?: string;
  matched: boolean;
  confidence?: number;
  color: string;
}) {
  const badgeStyle: React.CSSProperties = {
    backgroundColor: `${color}20`,
    color: color,
  };

  return (
    <div
      className="p-2 rounded-lg bg-slate-800/50 border border-slate-700"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-white text-sm">{name}</span>
        <StaffMatchBadge matched={matched} confidence={confidence} />
      </div>
      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
        <span
          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
          style={badgeStyle}
        >
          {position}
        </span>
        <Clock className="h-3 w-3" />
        {shift}
        {area && <span className="text-slate-500">• {area}</span>}
      </div>
    </div>
  );
}
