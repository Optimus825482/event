"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Table2,
  Clock,
  Loader2,
  Save,
  Eye,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// Hizmet Noktası Personel Ataması
interface ParsedServicePointAssignment {
  staffName: string;
  staffId?: string;
  shiftStart: string;
  shiftEnd: string;
  matchConfidence: number;
  matchedStaff?: { id: string; fullName: string };
}

// Hizmet Noktası (Bar, Depo, vb.)
interface ParsedServicePoint {
  name: string;
  pointType: "bar" | "depo" | "fuaye" | "casino" | "other";
  color: string;
  assignments: ParsedServicePointAssignment[];
}

// Extra Personel (Event'e özel, staff tablosunda olmayan)
interface ParsedExtraPersonnel {
  staffName: string;
  tableIds: string[];
  shiftStart: string;
  shiftEnd: string;
  isBackground?: boolean;
}

// Destek Ekibi Üyesi
interface ParsedSupportTeamMember {
  staffName: string;
  position: string;
  assignment: string;
  tableIds: string[];
  shiftStart: string;
  shiftEnd: string;
  isNotComing?: boolean;
}

// Destek Ekibi
interface ParsedSupportTeam {
  name: string;
  color: string;
  members: ParsedSupportTeamMember[];
}

// Kaptan
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

// Süpervizör
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

// Loca Kaptanı
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
  aiParsed?: boolean; // AI ile parse edildi mi?
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

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onImportComplete: (groups: ParsedGroup[]) => void;
}

export function ExcelImportModal({
  isOpen,
  onClose,
  eventId,
  onImportComplete,
}: ExcelImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [clearExisting, setClearExisting] = useState(true);
  const [selectedTab, setSelectedTab] = useState("overview");

  // Eşleşmeyen personeller için state
  const [unmatchedSelections, setUnmatchedSelections] = useState<
    Record<
      string,
      { selected: boolean; action: "extra" | "custom"; customLabel?: string }
    >
  >({});

  // Eşleşmeyen personel seçimini toggle et
  const toggleUnmatchedSelection = useCallback((staffName: string) => {
    setUnmatchedSelections((prev) => ({
      ...prev,
      [staffName]: {
        ...prev[staffName],
        selected: !prev[staffName]?.selected,
        action: prev[staffName]?.action || "extra",
      },
    }));
  }, []);

  // Eşleşmeyen personel aksiyonunu değiştir
  const setUnmatchedAction = useCallback(
    (staffName: string, action: "extra" | "custom", customLabel?: string) => {
      setUnmatchedSelections((prev) => ({
        ...prev,
        [staffName]: {
          ...prev[staffName],
          selected: prev[staffName]?.selected ?? true,
          action,
          customLabel,
        },
      }));
    },
    []
  );

  // Dosya yükleme
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setAnalysisResult(null);
    }
  }, []);

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

  // Excel analiz et
  const handleAnalyze = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post<AnalysisResult>(
        `/excel-import/analyze/${eventId}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setAnalysisResult(response.data);
    } catch (error: any) {
      console.error("Analiz hatası:", error);
      const message =
        error.response?.data?.message ||
        error.message ||
        "Excel analiz edilemedi";
      alert(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Onaylayıp kaydet
  const handleConfirmSave = async () => {
    if (!analysisResult) return;

    setIsSaving(true);
    try {
      await api.post(`/excel-import/confirm/${eventId}`, {
        analysisResult,
        options: { clearExisting },
      });

      // Grupları parent'a gönder
      onImportComplete(analysisResult.groups);

      // Modal'ı kapat ve state'i sıfırla
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

  // Modal'ı kapat ve state'i sıfırla
  const handleClose = () => {
    setFile(null);
    setAnalysisResult(null);
    setSelectedTab("overview");
    setUnmatchedSelections({});
    onClose();
  };

  // Eşleşme güvenine göre renk
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-400 bg-green-500/20";
    if (confidence >= 70) return "text-yellow-400 bg-yellow-500/20";
    if (confidence >= 50) return "text-orange-400 bg-orange-500/20";
    return "text-red-400 bg-red-500/20";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            Excel'den Personel Aktarımı
            {analysisResult?.aiParsed && (
              <Badge className="ml-2 bg-violet-500/20 text-violet-400 border-violet-500/30">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Destekli
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Dosya Yükleme Alanı */}
          {!analysisResult && (
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragActive
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-600 hover:border-emerald-500/50"
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-3">
                {file ? (
                  <>
                    <FileSpreadsheet className="h-12 w-12 text-emerald-400" />
                    <div>
                      <p className="font-medium text-white">{file.name}</p>
                      <p className="text-sm text-slate-400">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAnalyze();
                      }}
                      disabled={isAnalyzing}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analiz Ediliyor...
                        </>
                      ) : (
                        <>
                          <Eye className="mr-2 h-4 w-4" />
                          Analiz Et
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-slate-500" />
                    <div>
                      <p className="font-medium text-slate-300">
                        Excel dosyasını sürükleyip bırakın
                      </p>
                      <p className="text-sm text-slate-500">
                        veya tıklayarak seçin (.xlsx, .xls)
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Analiz Sonucu */}
          {analysisResult && (
            <div className="flex flex-col gap-4 overflow-hidden">
              {/* Özet Kartları */}
              <div className="grid grid-cols-5 gap-2">
                <div className="bg-slate-800 rounded-lg p-2 border border-slate-700">
                  <div className="flex items-center gap-2">
                    <Table2 className="h-4 w-4 text-blue-400" />
                    <div>
                      <p className="text-base font-bold text-white">
                        {analysisResult.summary.tableGroups}
                      </p>
                      <p className="text-xs text-slate-400">Masa Grubu</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-lg p-2 border border-slate-700">
                  <div className="flex items-center gap-2">
                    <Table2 className="h-4 w-4 text-purple-400" />
                    <div>
                      <p className="text-base font-bold text-white">
                        {analysisResult.summary.locaGroups}
                      </p>
                      <p className="text-xs text-slate-400">Loca</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-lg p-2 border border-slate-700">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
                    <div>
                      <p className="text-base font-bold text-white">
                        {analysisResult.summary.servicePoints || 0}
                      </p>
                      <p className="text-xs text-slate-400">Hizmet Nok.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-lg p-2 border border-slate-700">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-yellow-400" />
                    <div>
                      <p className="text-base font-bold text-white">
                        {analysisResult.summary.extraPersonnel || 0}
                      </p>
                      <p className="text-xs text-slate-400">Extra</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-lg p-2 border border-slate-700">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-400" />
                    <div>
                      <p className="text-base font-bold text-white">
                        {analysisResult.summary.supportTeamMembers || 0}
                      </p>
                      <p className="text-xs text-slate-400">Destek</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* İkinci satır - Yöneticiler */}
              <div className="grid grid-cols-5 gap-2">
                <div className="bg-slate-800 rounded-lg p-2 border border-lime-500/30">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-lime-400" />
                    <div>
                      <p className="text-base font-bold text-white">
                        {analysisResult.summary.captains || 0}
                      </p>
                      <p className="text-xs text-slate-400">Kaptan</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-lg p-2 border border-orange-500/30">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-orange-400" />
                    <div>
                      <p className="text-base font-bold text-white">
                        {analysisResult.summary.supervisors || 0}
                      </p>
                      <p className="text-xs text-slate-400">Süpervizör</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-lg p-2 border border-pink-500/30">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-pink-400" />
                    <div>
                      <p className="text-base font-bold text-white">
                        {analysisResult.summary.locaCaptains || 0}
                      </p>
                      <p className="text-xs text-slate-400">Loca Kpt.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-lg p-2 border border-slate-700">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400" />
                    <div>
                      <p className="text-base font-bold text-white">
                        {analysisResult.summary.matchedStaff}
                      </p>
                      <p className="text-xs text-slate-400">Eşleşen</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-lg p-2 border border-slate-700">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <div>
                      <p className="text-base font-bold text-white">
                        {analysisResult.summary.unmatchedStaff}
                      </p>
                      <p className="text-xs text-slate-400">Eşleşmeyen</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detay Tabları */}
              <Tabs
                value={selectedTab}
                onValueChange={setSelectedTab}
                className="flex-1 overflow-hidden flex flex-col"
              >
                <TabsList className="bg-slate-800 border border-slate-700">
                  <TabsTrigger
                    value="overview"
                    className="data-[state=active]:bg-slate-700"
                  >
                    Genel Bakış
                  </TabsTrigger>
                  <TabsTrigger
                    value="groups"
                    className="data-[state=active]:bg-slate-700"
                  >
                    Gruplar ({analysisResult.totalGroups})
                  </TabsTrigger>
                  <TabsTrigger
                    value="assignments"
                    className="data-[state=active]:bg-slate-700"
                  >
                    Atamalar ({analysisResult.totalAssignments})
                  </TabsTrigger>
                  {analysisResult.servicePoints &&
                    analysisResult.servicePoints.length > 0 && (
                      <TabsTrigger
                        value="servicepoints"
                        className="data-[state=active]:bg-slate-700 text-cyan-400"
                      >
                        Hizmet Noktaları ({analysisResult.servicePoints.length})
                      </TabsTrigger>
                    )}
                  {analysisResult.extraPersonnel &&
                    analysisResult.extraPersonnel.length > 0 && (
                      <TabsTrigger
                        value="extrapersonnel"
                        className="data-[state=active]:bg-slate-700 text-yellow-400"
                      >
                        Extra ({analysisResult.extraPersonnel.length})
                      </TabsTrigger>
                    )}
                  {analysisResult.supportTeams &&
                    analysisResult.supportTeams.length > 0 && (
                      <TabsTrigger
                        value="supportteams"
                        className="data-[state=active]:bg-slate-700 text-green-400"
                      >
                        Destek ({analysisResult.summary.supportTeamMembers || 0}
                        )
                      </TabsTrigger>
                    )}
                  {analysisResult.captains &&
                    analysisResult.captains.length > 0 && (
                      <TabsTrigger
                        value="captains"
                        className="data-[state=active]:bg-slate-700 text-lime-400"
                      >
                        Kaptanlar ({analysisResult.captains.length})
                      </TabsTrigger>
                    )}
                  {analysisResult.supervisors &&
                    analysisResult.supervisors.length > 0 && (
                      <TabsTrigger
                        value="supervisors"
                        className="data-[state=active]:bg-slate-700 text-orange-400"
                      >
                        Süpervizörler ({analysisResult.supervisors.length})
                      </TabsTrigger>
                    )}
                  {analysisResult.locaCaptains &&
                    analysisResult.locaCaptains.length > 0 && (
                      <TabsTrigger
                        value="locacaptains"
                        className="data-[state=active]:bg-slate-700 text-pink-400"
                      >
                        Loca Kpt. ({analysisResult.locaCaptains.length})
                      </TabsTrigger>
                    )}
                  {analysisResult.unmatchedStaff.length > 0 && (
                    <TabsTrigger
                      value="unmatched"
                      className="data-[state=active]:bg-slate-700 text-red-400"
                    >
                      Eşleşmeyenler ({analysisResult.unmatchedStaff.length})
                    </TabsTrigger>
                  )}
                </TabsList>

                <div className="flex-1 overflow-hidden mt-3">
                  {/* Genel Bakış */}
                  <TabsContent value="overview" className="h-full m-0">
                    <ScrollArea className="h-[300px]">
                      <div className="grid grid-cols-2 gap-3 pr-4">
                        {analysisResult.groups.map((group) => (
                          <div
                            key={group.name}
                            className="p-3 rounded-lg border border-slate-700 bg-slate-800/50"
                            style={{
                              borderLeftColor: group.color,
                              borderLeftWidth: 4,
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-white">
                                {group.name}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-slate-300 border-slate-600"
                              >
                                {group.assignments.length} kişi
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-400 mb-2">
                              Masalar: {group.tableIds.join(", ")}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {group.assignments.slice(0, 3).map((a, i) => (
                                <Badge
                                  key={i}
                                  className="text-xs bg-slate-700 text-slate-300"
                                >
                                  {a.staffName}
                                </Badge>
                              ))}
                              {group.assignments.length > 3 && (
                                <Badge className="text-xs bg-slate-700 text-slate-300">
                                  +{group.assignments.length - 3}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Gruplar */}
                  <TabsContent value="groups" className="h-full m-0">
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700">
                            <TableHead className="text-slate-400">
                              Grup
                            </TableHead>
                            <TableHead className="text-slate-400">
                              Tip
                            </TableHead>
                            <TableHead className="text-slate-400">
                              Masalar
                            </TableHead>
                            <TableHead className="text-slate-400">
                              Personel
                            </TableHead>
                            <TableHead className="text-slate-400">
                              Renk
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analysisResult.groups.map((group) => (
                            <TableRow
                              key={group.name}
                              className="border-slate-700"
                            >
                              <TableCell className="font-medium text-white">
                                {group.name}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    group.groupType === "loca"
                                      ? "bg-purple-500/20 text-purple-400"
                                      : "bg-blue-500/20 text-blue-400"
                                  }
                                >
                                  {group.groupType === "loca" ? "Loca" : "Masa"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-slate-300 max-w-[150px] truncate">
                                {group.tableIds.join(", ")}
                              </TableCell>
                              <TableCell className="text-slate-300">
                                {group.assignments.length}
                              </TableCell>
                              <TableCell>
                                <div
                                  className="w-6 h-6 rounded"
                                  style={{ backgroundColor: group.color }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>

                  {/* Atamalar */}
                  <TabsContent value="assignments" className="h-full m-0">
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700">
                            <TableHead className="text-slate-400">
                              Personel
                            </TableHead>
                            <TableHead className="text-slate-400">
                              Eşleşen
                            </TableHead>
                            <TableHead className="text-slate-400">
                              Grup
                            </TableHead>
                            <TableHead className="text-slate-400">
                              Vardiya
                            </TableHead>
                            <TableHead className="text-slate-400">
                              Güven
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analysisResult.groups.flatMap((group) =>
                            group.assignments.map((assignment, idx) => (
                              <TableRow
                                key={`${group.name}-${idx}`}
                                className="border-slate-700"
                              >
                                <TableCell className="text-white">
                                  {assignment.staffName}
                                </TableCell>
                                <TableCell>
                                  {assignment.matchedStaff ? (
                                    <div className="flex items-center gap-1 text-emerald-400">
                                      <CheckCircle2 className="h-4 w-4" />
                                      <span className="text-sm">
                                        {assignment.matchedStaff.fullName}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-red-400">
                                      <XCircle className="h-4 w-4" />
                                      <span className="text-sm">
                                        Bulunamadı
                                      </span>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded"
                                      style={{ backgroundColor: group.color }}
                                    />
                                    <span className="text-slate-300">
                                      {group.name}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-slate-400">
                                    <Clock className="h-3 w-3" />
                                    <span className="text-xs">
                                      {assignment.shiftStart}-
                                      {assignment.shiftEnd}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={cn(
                                      "text-xs",
                                      getConfidenceColor(
                                        assignment.matchConfidence
                                      )
                                    )}
                                  >
                                    %{assignment.matchConfidence}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>

                  {/* Hizmet Noktaları */}
                  <TabsContent value="servicepoints" className="h-full m-0">
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-4 pr-4">
                        {analysisResult.servicePoints?.map((sp, spIdx) => (
                          <div
                            key={spIdx}
                            className="p-3 rounded-lg border border-slate-700 bg-slate-800/50"
                            style={{
                              borderLeftColor: sp.color,
                              borderLeftWidth: 4,
                            }}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">
                                  {sp.name}
                                </span>
                                <Badge
                                  className="text-xs"
                                  style={{
                                    backgroundColor: `${sp.color}20`,
                                    color: sp.color,
                                  }}
                                >
                                  {sp.pointType.toUpperCase()}
                                </Badge>
                              </div>
                              <Badge
                                variant="outline"
                                className="text-slate-300 border-slate-600"
                              >
                                {sp.assignments.length} kişi
                              </Badge>
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow className="border-slate-700">
                                  <TableHead className="text-slate-400 text-xs py-1">
                                    Personel
                                  </TableHead>
                                  <TableHead className="text-slate-400 text-xs py-1">
                                    Eşleşen
                                  </TableHead>
                                  <TableHead className="text-slate-400 text-xs py-1">
                                    Vardiya
                                  </TableHead>
                                  <TableHead className="text-slate-400 text-xs py-1">
                                    Güven
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sp.assignments.map((assignment, aIdx) => (
                                  <TableRow
                                    key={aIdx}
                                    className="border-slate-700"
                                  >
                                    <TableCell className="text-white py-1 text-sm">
                                      {assignment.staffName}
                                    </TableCell>
                                    <TableCell className="py-1">
                                      {assignment.matchedStaff ? (
                                        <div className="flex items-center gap-1 text-emerald-400">
                                          <CheckCircle2 className="h-3 w-3" />
                                          <span className="text-xs">
                                            {assignment.matchedStaff.fullName}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1 text-red-400">
                                          <XCircle className="h-3 w-3" />
                                          <span className="text-xs">
                                            Bulunamadı
                                          </span>
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-1">
                                      <div className="flex items-center gap-1 text-slate-400">
                                        <Clock className="h-3 w-3" />
                                        <span className="text-xs">
                                          {assignment.shiftStart}-
                                          {assignment.shiftEnd}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-1">
                                      <Badge
                                        className={cn(
                                          "text-xs",
                                          getConfidenceColor(
                                            assignment.matchConfidence
                                          )
                                        )}
                                      >
                                        %{assignment.matchConfidence}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ))}
                        {(!analysisResult.servicePoints ||
                          analysisResult.servicePoints.length === 0) && (
                          <div className="text-center py-8 text-slate-500">
                            Hizmet noktası bulunamadı
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Extra Personel */}
                  <TabsContent value="extrapersonnel" className="h-full m-0">
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3 pr-4">
                        <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                          <div className="flex items-center gap-2 text-yellow-400 mb-2">
                            <Users className="h-5 w-5" />
                            <span className="font-medium">
                              Event&apos;e Özel Extra Personeller
                            </span>
                          </div>
                          <p className="text-sm text-yellow-300/70">
                            Bu personeller staff tablosunda bulunmuyor.
                            Event&apos;e özel olarak eklenecekler.
                          </p>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow className="border-slate-700">
                              <TableHead className="text-slate-400">
                                Personel
                              </TableHead>
                              <TableHead className="text-slate-400">
                                Masalar
                              </TableHead>
                              <TableHead className="text-slate-400">
                                Vardiya
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {analysisResult.extraPersonnel?.map(
                              (person, idx) => (
                                <TableRow
                                  key={idx}
                                  className="border-slate-700"
                                >
                                  <TableCell className="text-white font-medium">
                                    {person.staffName}
                                  </TableCell>
                                  <TableCell className="text-slate-300">
                                    {person.tableIds.length > 0 ? (
                                      person.tableIds.join(", ")
                                    ) : (
                                      <span className="text-slate-500">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1 text-slate-400">
                                      <Clock className="h-3 w-3" />
                                      <span className="text-xs">
                                        {person.shiftStart}-{person.shiftEnd}
                                      </span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            )}
                          </TableBody>
                        </Table>

                        {(!analysisResult.extraPersonnel ||
                          analysisResult.extraPersonnel.length === 0) && (
                          <div className="text-center py-8 text-slate-500">
                            Extra personel bulunamadı
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Destek Ekipleri */}
                  <TabsContent value="supportteams" className="h-full m-0">
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-4 pr-4">
                        {analysisResult.supportTeams?.map((team, teamIdx) => (
                          <div
                            key={teamIdx}
                            className="p-3 rounded-lg border border-slate-700 bg-slate-800/50"
                            style={{
                              borderLeftColor: team.color,
                              borderLeftWidth: 4,
                            }}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">
                                  {team.name}
                                </span>
                              </div>
                              <Badge
                                variant="outline"
                                className="text-slate-300 border-slate-600"
                              >
                                {team.members.length} kişi
                              </Badge>
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow className="border-slate-700">
                                  <TableHead className="text-slate-400 text-xs py-1">
                                    Personel
                                  </TableHead>
                                  <TableHead className="text-slate-400 text-xs py-1">
                                    Pozisyon
                                  </TableHead>
                                  <TableHead className="text-slate-400 text-xs py-1">
                                    Görev/Masa
                                  </TableHead>
                                  <TableHead className="text-slate-400 text-xs py-1">
                                    Vardiya
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {team.members.map((member, mIdx) => (
                                  <TableRow
                                    key={mIdx}
                                    className="border-slate-700"
                                  >
                                    <TableCell className="text-white py-1 text-sm">
                                      {member.staffName}
                                    </TableCell>
                                    <TableCell className="py-1">
                                      <Badge
                                        className={cn(
                                          "text-xs",
                                          member.position === "SPVR" &&
                                            "bg-red-500/20 text-red-400",
                                          member.position === "CAPTAIN" &&
                                            "bg-orange-500/20 text-orange-400",
                                          member.position === "PERSONEL" &&
                                            "bg-blue-500/20 text-blue-400"
                                        )}
                                      >
                                        {member.position}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-slate-300 py-1 text-sm">
                                      {member.assignment}
                                    </TableCell>
                                    <TableCell className="py-1">
                                      <div className="flex items-center gap-1 text-slate-400">
                                        <Clock className="h-3 w-3" />
                                        <span className="text-xs">
                                          {member.shiftStart}-{member.shiftEnd}
                                        </span>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ))}
                        {(!analysisResult.supportTeams ||
                          analysisResult.supportTeams.length === 0) && (
                          <div className="text-center py-8 text-slate-500">
                            Destek ekibi bulunamadı
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Kaptanlar */}
                  <TabsContent value="captains" className="h-full m-0">
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3 pr-4">
                        <div className="p-3 bg-lime-500/10 rounded-lg border border-lime-500/30">
                          <div className="flex items-center gap-2 text-lime-400 mb-2">
                            <Users className="h-5 w-5" />
                            <span className="font-medium">
                              Takım Kaptanları
                            </span>
                          </div>
                          <p className="text-sm text-lime-300/70">
                            Gruplar birleştirilip takım oluşturulduğunda bu
                            kaptanlar atanacak.
                          </p>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow className="border-slate-700">
                              <TableHead className="text-slate-400">
                                Personel
                              </TableHead>
                              <TableHead className="text-slate-400">
                                Pozisyon
                              </TableHead>
                              <TableHead className="text-slate-400">
                                Alan
                              </TableHead>
                              <TableHead className="text-slate-400">
                                Vardiya
                              </TableHead>
                              <TableHead className="text-slate-400">
                                Eşleşme
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {analysisResult.captains?.map((captain, idx) => (
                              <TableRow key={idx} className="border-slate-700">
                                <TableCell className="text-white font-medium">
                                  {captain.staffName}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={cn(
                                      "text-xs",
                                      captain.position === "CAPTAIN" &&
                                        "bg-lime-500/20 text-lime-400",
                                      captain.position === "J. CAPTAIN" &&
                                        "bg-teal-500/20 text-teal-400",
                                      captain.position === "INCHARGE" &&
                                        "bg-sky-500/20 text-sky-400"
                                    )}
                                  >
                                    {captain.position}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-slate-300">
                                  {captain.area || "-"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-slate-400">
                                    <Clock className="h-3 w-3" />
                                    <span className="text-xs">
                                      {captain.shiftStart}-{captain.shiftEnd}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {captain.matchedStaff ? (
                                    <div className="flex items-center gap-1 text-emerald-400">
                                      <CheckCircle2 className="h-3 w-3" />
                                      <span className="text-xs">
                                        %{captain.matchConfidence}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-red-400">
                                      <XCircle className="h-3 w-3" />
                                      <span className="text-xs">Yok</span>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {(!analysisResult.captains ||
                          analysisResult.captains.length === 0) && (
                          <div className="text-center py-8 text-slate-500">
                            Kaptan bulunamadı
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Süpervizörler */}
                  <TabsContent value="supervisors" className="h-full m-0">
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3 pr-4">
                        <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
                          <div className="flex items-center gap-2 text-orange-400 mb-2">
                            <Users className="h-5 w-5" />
                            <span className="font-medium">Süpervizörler</span>
                          </div>
                          <p className="text-sm text-orange-300/70">
                            1&apos;den fazla takıma atanabilecek süpervizörler.
                          </p>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow className="border-slate-700">
                              <TableHead className="text-slate-400">
                                Personel
                              </TableHead>
                              <TableHead className="text-slate-400">
                                Alan
                              </TableHead>
                              <TableHead className="text-slate-400">
                                Vardiya
                              </TableHead>
                              <TableHead className="text-slate-400">
                                Eşleşme
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {analysisResult.supervisors?.map(
                              (supervisor, idx) => (
                                <TableRow
                                  key={idx}
                                  className="border-slate-700"
                                >
                                  <TableCell className="text-white font-medium">
                                    {supervisor.staffName}
                                  </TableCell>
                                  <TableCell>
                                    {supervisor.area ? (
                                      <Badge
                                        className={cn(
                                          "text-xs",
                                          supervisor.area === "LOCA" &&
                                            "bg-purple-500/20 text-purple-400",
                                          supervisor.area === "SALON" &&
                                            "bg-blue-500/20 text-blue-400"
                                        )}
                                      >
                                        {supervisor.area}
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-500">
                                        GENEL
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1 text-slate-400">
                                      <Clock className="h-3 w-3" />
                                      <span className="text-xs">
                                        {supervisor.shiftStart}-
                                        {supervisor.shiftEnd}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {supervisor.matchedStaff ? (
                                      <div className="flex items-center gap-1 text-emerald-400">
                                        <CheckCircle2 className="h-3 w-3" />
                                        <span className="text-xs">
                                          %{supervisor.matchConfidence}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 text-red-400">
                                        <XCircle className="h-3 w-3" />
                                        <span className="text-xs">Yok</span>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            )}
                          </TableBody>
                        </Table>

                        {(!analysisResult.supervisors ||
                          analysisResult.supervisors.length === 0) && (
                          <div className="text-center py-8 text-slate-500">
                            Süpervizör bulunamadı
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Loca Kaptanları */}
                  <TabsContent value="locacaptains" className="h-full m-0">
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3 pr-4">
                        <div className="p-3 bg-pink-500/10 rounded-lg border border-pink-500/30">
                          <div className="flex items-center gap-2 text-pink-400 mb-2">
                            <Users className="h-5 w-5" />
                            <span className="font-medium">Loca Kaptanları</span>
                          </div>
                          <p className="text-sm text-pink-300/70">
                            Loca grupları birleştirildiğinde atanacak kaptanlar.
                          </p>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow className="border-slate-700">
                              <TableHead className="text-slate-400">
                                Personel
                              </TableHead>
                              <TableHead className="text-slate-400">
                                Alan
                              </TableHead>
                              <TableHead className="text-slate-400">
                                Vardiya
                              </TableHead>
                              <TableHead className="text-slate-400">
                                Eşleşme
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {analysisResult.locaCaptains?.map(
                              (locaCaptain, idx) => (
                                <TableRow
                                  key={idx}
                                  className="border-slate-700"
                                >
                                  <TableCell className="text-white font-medium">
                                    {locaCaptain.staffName}
                                  </TableCell>
                                  <TableCell>
                                    {locaCaptain.area ? (
                                      <Badge className="text-xs bg-blue-500/20 text-blue-400">
                                        {locaCaptain.area}
                                      </Badge>
                                    ) : (
                                      <Badge className="text-xs bg-purple-500/20 text-purple-400">
                                        LOCA
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1 text-slate-400">
                                      <Clock className="h-3 w-3" />
                                      <span className="text-xs">
                                        {locaCaptain.shiftStart}-
                                        {locaCaptain.shiftEnd}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {locaCaptain.matchedStaff ? (
                                      <div className="flex items-center gap-1 text-emerald-400">
                                        <CheckCircle2 className="h-3 w-3" />
                                        <span className="text-xs">
                                          %{locaCaptain.matchConfidence}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 text-red-400">
                                        <XCircle className="h-3 w-3" />
                                        <span className="text-xs">Yok</span>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            )}
                          </TableBody>
                        </Table>

                        {(!analysisResult.locaCaptains ||
                          analysisResult.locaCaptains.length === 0) && (
                          <div className="text-center py-8 text-slate-500">
                            Loca kaptanı bulunamadı
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Eşleşmeyenler */}
                  <TabsContent value="unmatched" className="h-full m-0">
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3 pr-4">
                        <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                          <div className="flex items-center gap-2 text-amber-400 mb-2">
                            <AlertTriangle className="h-5 w-5" />
                            <span className="font-medium">
                              Bu personeller sistemde bulunamadı
                            </span>
                          </div>
                          <p className="text-sm text-amber-300/70">
                            Seçtiklerinizi "Ekstra Personel" olarak ekleyebilir
                            veya özel bir etiket yazabilirsiniz.
                          </p>
                        </div>

                        {/* Eşleşmeyen personel listesi */}
                        <div className="space-y-2">
                          {analysisResult.unmatchedStaff.map((name, idx) => {
                            const selection = unmatchedSelections[name] || {
                              selected: false,
                              action: "extra",
                            };
                            return (
                              <div
                                key={idx}
                                className={cn(
                                  "p-3 rounded-lg border transition-all",
                                  selection.selected
                                    ? "bg-emerald-500/10 border-emerald-500/50"
                                    : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Checkbox */}
                                  <Checkbox
                                    checked={selection.selected}
                                    onCheckedChange={() =>
                                      toggleUnmatchedSelection(name)
                                    }
                                    className="border-slate-500"
                                  />

                                  {/* İsim */}
                                  <span className="text-white font-medium flex-1">
                                    {name}
                                  </span>

                                  {/* Seçenekler - sadece seçiliyse göster */}
                                  {selection.selected && (
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() =>
                                          setUnmatchedAction(name, "extra")
                                        }
                                        className={cn(
                                          "px-2 py-1 rounded text-xs font-medium transition-all",
                                          selection.action === "extra"
                                            ? "bg-emerald-600 text-white"
                                            : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                                        )}
                                      >
                                        Ekstra Personel
                                      </button>
                                      <button
                                        onClick={() =>
                                          setUnmatchedAction(name, "custom")
                                        }
                                        className={cn(
                                          "px-2 py-1 rounded text-xs font-medium transition-all",
                                          selection.action === "custom"
                                            ? "bg-blue-600 text-white"
                                            : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                                        )}
                                      >
                                        Özel Etiket
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Özel etiket input - sadece custom seçiliyse */}
                                {selection.selected &&
                                  selection.action === "custom" && (
                                    <div className="mt-2 pl-7">
                                      <Input
                                        value={selection.customLabel || ""}
                                        onChange={(e) =>
                                          setUnmatchedAction(
                                            name,
                                            "custom",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Örn: Merit Royal Premium Destek Ekibi"
                                        className="h-8 text-sm bg-slate-700 border-slate-600"
                                      />
                                    </div>
                                  )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Toplu seçim butonları */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const newSelections: typeof unmatchedSelections =
                                {};
                              analysisResult.unmatchedStaff.forEach((name) => {
                                newSelections[name] = {
                                  selected: true,
                                  action: "extra",
                                };
                              });
                              setUnmatchedSelections(newSelections);
                            }}
                            className="text-xs border-slate-600 text-slate-300"
                          >
                            Tümünü Seç (Ekstra)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setUnmatchedSelections({})}
                            className="text-xs border-slate-600 text-slate-300"
                          >
                            Seçimi Temizle
                          </Button>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </div>
              </Tabs>

              {/* Alt Butonlar */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-700">
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
                <div className="flex gap-2">
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
                    className="bg-emerald-600 hover:bg-emerald-700"
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
