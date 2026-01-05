"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
  ArrowLeft,
  Save,
  Eye,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface AnalysisResult {
  eventId: string;
  eventName?: string;
  totalGroups: number;
  totalAssignments: number;
  groups: ParsedGroup[];
  unmatchedStaff: string[];
  warnings: string[];
  summary: {
    tableGroups: number;
    locaGroups: number;
    matchedStaff: number;
    unmatchedStaff: number;
  };
}

export default function ExcelImportPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [clearExisting, setClearExisting] = useState(true);
  const [selectedTab, setSelectedTab] = useState("overview");

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
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  // Excel analiz et
  const handleAnalyze = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/excel-import/analyze/${eventId}`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Analiz başarısız");
      }

      const result: AnalysisResult = await response.json();
      setAnalysisResult(result);
      toast.success("Excel başarıyla analiz edildi!");
    } catch (error) {
      console.error("Analiz hatası:", error);
      toast.error("Excel analiz edilemedi");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Onaylayıp kaydet
  const handleConfirmSave = async () => {
    if (!analysisResult) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/excel-import/confirm/${eventId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analysisResult,
            options: { clearExisting },
          }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Kaydetme başarısız");
      }

      const result = await response.json();
      toast.success(
        `${result.savedGroups} grup ve ${result.savedAssignments} atama kaydedildi!`
      );
      setShowConfirmDialog(false);

      // Ekip organizasyonu sayfasına yönlendir
      router.push(`/events/${eventId}/team-organization`);
    } catch (error) {
      console.error("Kaydetme hatası:", error);
      toast.error("Veriler kaydedilemedi");
    } finally {
      setIsSaving(false);
    }
  };

  // Eşleşme güvenine göre renk
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-600 bg-green-50";
    if (confidence >= 70) return "text-yellow-600 bg-yellow-50";
    if (confidence >= 50) return "text-orange-600 bg-orange-50";
    return "text-red-600 bg-red-50";
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Excel'den Personel Aktarımı</h1>
            <p className="text-muted-foreground">
              Çalışma planı Excel dosyasını yükleyin, sistem otomatik analiz
              edecek
            </p>
          </div>
        </div>
      </div>

      {/* Dosya Yükleme Alanı */}
      {!analysisResult && (
        <Card>
          <CardContent className="pt-6">
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-4">
                {file ? (
                  <>
                    <FileSpreadsheet className="h-16 w-16 text-green-600" />
                    <div>
                      <p className="font-medium text-lg">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analiz Ediliyor...
                        </>
                      ) : (
                        <>
                          <Eye className="mr-2 h-4 w-4" />
                          Analiz Et ve Önizle
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Upload className="h-16 w-16 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-lg">
                        Excel dosyasını sürükleyip bırakın
                      </p>
                      <p className="text-sm text-muted-foreground">
                        veya tıklayarak seçin (.xlsx, .xls)
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analiz Sonucu */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Özet Kartları */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Table2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {analysisResult.summary.tableGroups}
                    </p>
                    <p className="text-sm text-muted-foreground">Masa Grubu</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Table2 className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {analysisResult.summary.locaGroups}
                    </p>
                    <p className="text-sm text-muted-foreground">Loca Grubu</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {analysisResult.summary.matchedStaff}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Eşleşen Personel
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {analysisResult.summary.unmatchedStaff}
                    </p>
                    <p className="text-sm text-muted-foreground">Eşleşmeyen</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detay Tabları */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Analiz Sonucu Önizleme</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setAnalysisResult(null);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Temizle
                  </Button>
                  <Button onClick={() => setShowConfirmDialog(true)}>
                    <Save className="mr-2 h-4 w-4" />
                    Onayla ve Kaydet
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
                  <TabsTrigger value="groups">
                    Gruplar ({analysisResult.totalGroups})
                  </TabsTrigger>
                  <TabsTrigger value="assignments">
                    Atamalar ({analysisResult.totalAssignments})
                  </TabsTrigger>
                  {analysisResult.unmatchedStaff.length > 0 && (
                    <TabsTrigger value="unmatched" className="text-red-600">
                      Eşleşmeyenler ({analysisResult.unmatchedStaff.length})
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* Genel Bakış */}
                <TabsContent value="overview">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {analysisResult.groups.slice(0, 8).map((group) => (
                        <div
                          key={group.name}
                          className="p-4 rounded-lg border"
                          style={{
                            borderLeftColor: group.color,
                            borderLeftWidth: 4,
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{group.name}</span>
                            <Badge variant="outline">
                              {group.assignments.length} kişi
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Masalar: {group.tableIds.join(", ")}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {group.assignments.slice(0, 3).map((a, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-xs"
                              >
                                {a.staffName}
                              </Badge>
                            ))}
                            {group.assignments.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{group.assignments.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {analysisResult.groups.length > 8 && (
                      <p className="text-center text-muted-foreground">
                        ve {analysisResult.groups.length - 8} grup daha...
                      </p>
                    )}
                  </div>
                </TabsContent>

                {/* Gruplar */}
                <TabsContent value="groups">
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Grup</TableHead>
                          <TableHead>Tip</TableHead>
                          <TableHead>Masalar</TableHead>
                          <TableHead>Personel Sayısı</TableHead>
                          <TableHead>Renk</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysisResult.groups.map((group) => (
                          <TableRow key={group.name}>
                            <TableCell className="font-medium">
                              {group.name}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  group.groupType === "loca"
                                    ? "secondary"
                                    : "default"
                                }
                              >
                                {group.groupType === "loca" ? "Loca" : "Masa"}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {group.tableIds.join(", ")}
                            </TableCell>
                            <TableCell>{group.assignments.length}</TableCell>
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
                <TabsContent value="assignments">
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Personel (Excel)</TableHead>
                          <TableHead>Eşleşen</TableHead>
                          <TableHead>Grup</TableHead>
                          <TableHead>Masalar</TableHead>
                          <TableHead>Vardiya</TableHead>
                          <TableHead>Güven</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysisResult.groups.flatMap((group) =>
                          group.assignments.map((assignment, idx) => (
                            <TableRow key={`${group.name}-${idx}`}>
                              <TableCell>{assignment.staffName}</TableCell>
                              <TableCell>
                                {assignment.matchedStaff ? (
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span>
                                      {assignment.matchedStaff.fullName}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-red-600">
                                    <XCircle className="h-4 w-4" />
                                    <span>Bulunamadı</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded"
                                    style={{ backgroundColor: group.color }}
                                  />
                                  {group.name}
                                </div>
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate">
                                {assignment.tableIds.join(", ")}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {assignment.shiftStart}-{assignment.shiftEnd}
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

                {/* Eşleşmeyenler */}
                <TabsContent value="unmatched">
                  <div className="space-y-4">
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center gap-2 text-red-700 mb-2">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-medium">
                          Bu personeller sistemde bulunamadı
                        </span>
                      </div>
                      <p className="text-sm text-red-600">
                        Bu kişileri manuel olarak eklemeniz veya isimlerini
                        düzeltmeniz gerekebilir.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.unmatchedStaff.map((name, idx) => (
                        <Badge key={idx} variant="destructive">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Onay Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Personel Organizasyonunu Kaydet</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Excel'den okunan {analysisResult?.totalGroups} grup ve{" "}
                {analysisResult?.totalAssignments} personel ataması
                kaydedilecek.
              </p>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="clearExisting"
                  checked={clearExisting}
                  onCheckedChange={(checked) =>
                    setClearExisting(checked as boolean)
                  }
                />
                <label
                  htmlFor="clearExisting"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Mevcut grupları ve atamaları temizle
                </label>
              </div>
              {analysisResult && analysisResult.unmatchedStaff.length > 0 && (
                <div className="p-3 bg-yellow-50 rounded-lg text-yellow-800 text-sm">
                  <strong>Uyarı:</strong> {analysisResult.unmatchedStaff.length}{" "}
                  personel eşleştirilemedi ve atlanacak.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                "Onayla ve Kaydet"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
