"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Users,
  Loader2,
  Table2,
  ArrowLeft,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

// Types
interface ParsedReservationEntry {
  guestName: string;
  guestCount: number;
  tableLabel: string;
  tableId?: string;
  status: "matched" | "unmatched" | "warning";
  warning?: string;
}

interface ReservationImportPreview {
  totalEntries: number;
  matchedTables: number;
  unmatchedTables: number;
  totalGuests: number;
  entries: ParsedReservationEntry[];
  availableTables: {
    id: string;
    label: string;
    capacity: number;
    tableNumber?: number;
    locaName?: string;
    isLoca?: boolean;
  }[];
  warnings: string[];
}

interface ReservationImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

interface ReservationExcelImportProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

type Step = "upload" | "preview" | "result";

export function ReservationExcelImport({
  eventId,
  isOpen,
  onClose,
  onImportComplete,
}: ReservationExcelImportProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ReservationImportPreview | null>(null);
  const [result, setResult] = useState<ReservationImportResult | null>(null);
  const [entries, setEntries] = useState<ParsedReservationEntry[]>([]);
  const [clearExisting, setClearExisting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setAnalyzing(false);
    setImporting(false);
    setPreview(null);
    setResult(null);
    setEntries([]);
    setClearExisting(false);
    setError(null);
    setShowErrors(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && /\.(xlsx|xls)$/i.test(droppedFile.name)) {
      setFile(droppedFile);
      setError(null);
    } else {
      setError("Sadece Excel dosyaları kabul edilir (.xlsx, .xls)");
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
        setFile(selected);
        setError(null);
      }
    },
    [],
  );

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(
        `/excel-import/analyze-reservations/${eventId}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      const data: ReservationImportPreview = res.data;
      setPreview(data);
      setEntries(data.entries);
      setStep("preview");
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Dosya analiz edilirken hata oluştu",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTableAssign = (index: number, tableId: string) => {
    setEntries((prev) => {
      const updated = [...prev];
      const table = preview?.availableTables.find((t) => t.id === tableId);
      updated[index] = {
        ...updated[index],
        tableId,
        status: tableId ? "matched" : "unmatched",
        warning: tableId ? undefined : updated[index].warning,
        tableLabel: table?.label || updated[index].tableLabel,
      };
      return updated;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      const res = await api.post(
        `/excel-import/confirm-reservations/${eventId}`,
        { entries, options: { clearExisting } },
      );
      setResult(res.data);
      setStep("result");
      onImportComplete();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "İçe aktarma sırasında hata oluştu",
      );
    } finally {
      setImporting(false);
    }
  };

  const matchedCount = entries.filter((e) => e.tableId).length;
  const unmatchedCount = entries.filter((e) => !e.tableId).length;
  const totalGuests = entries.reduce((sum, e) => sum + e.guestCount, 0);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            Excel ile Toplu Rezervasyon
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Excel dosyasından toplu rezervasyon yükleyin
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                  dragOver
                    ? "border-emerald-400 bg-emerald-500/10"
                    : file
                      ? "border-emerald-500/50 bg-emerald-500/5"
                      : "border-slate-600 hover:border-slate-500 hover:bg-slate-700/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {file ? (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                      <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
                    </div>
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-sm text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-slate-700/50 rounded-2xl flex items-center justify-center">
                      <Upload className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-300 font-medium">
                      Excel dosyası sürükleyin veya seçin
                    </p>
                    <p className="text-sm text-slate-500">
                      .xlsx veya .xls formatında
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button
                onClick={handleAnalyze}
                disabled={!file || analyzing}
                className="w-full h-12 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium rounded-xl"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analiz ediliyor...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Analiz Et
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === "preview" && preview && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-700/50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-white">
                    {entries.length}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Toplam Kayıt
                  </div>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-400">
                    {matchedCount}
                  </div>
                  <div className="text-xs text-emerald-300/70 mt-1">
                    Eşleşen
                  </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-amber-400">
                    {unmatchedCount}
                  </div>
                  <div className="text-xs text-amber-300/70 mt-1">
                    Eşleşmeyen
                  </div>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {totalGuests}
                  </div>
                  <div className="text-xs text-purple-300/70 mt-1">
                    Toplam Misafir
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-amber-300 text-sm font-medium mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    {preview.warnings.length} Uyarı
                  </div>
                  <div className="max-h-20 overflow-y-auto space-y-1">
                    {preview.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-200/70">
                        {w}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Entries Table */}
              <div className="bg-slate-700/30 rounded-xl border border-slate-600/50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-600/50">
                  <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-purple-400" />
                    Önizleme
                  </span>
                  <Badge className="bg-slate-600/50 text-slate-300 text-xs">
                    {entries.length} kayıt
                  </Badge>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-700/50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 text-slate-400 font-medium">
                          Misafir
                        </th>
                        <th className="text-center px-2 py-2 text-slate-400 font-medium">
                          Kişi
                        </th>
                        <th className="text-left px-4 py-2 text-slate-400 font-medium">
                          Masa
                        </th>
                        <th className="text-center px-2 py-2 text-slate-400 font-medium">
                          Durum
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {entries.map((entry, idx) => (
                        <tr
                          key={idx}
                          className={`transition-colors ${
                            entry.tableId
                              ? "hover:bg-slate-700/30"
                              : "bg-amber-500/5 hover:bg-amber-500/10"
                          }`}
                        >
                          <td className="px-4 py-2.5 text-white font-medium">
                            {entry.guestName}
                          </td>
                          <td className="text-center px-2 py-2.5">
                            <span className="inline-flex items-center gap-1 text-slate-300">
                              <Users className="w-3 h-3" />
                              {entry.guestCount}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {entry.tableId ? (
                              <span className="text-emerald-300">
                                {entry.tableLabel}
                              </span>
                            ) : (
                              <select
                                value={entry.tableId || ""}
                                onChange={(e) =>
                                  handleTableAssign(idx, e.target.value)
                                }
                                className="w-full bg-slate-700 border border-amber-500/30 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-purple-500"
                              >
                                <option value="">
                                  {entry.tableLabel} (eşleşmedi)
                                </option>
                                {preview.availableTables.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.label} ({t.capacity} kişi)
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="text-center px-2 py-2.5">
                            {entry.tableId ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Options */}
              <label className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl cursor-pointer hover:bg-slate-700/50 transition-colors">
                <input
                  type="checkbox"
                  checked={clearExisting}
                  onChange={(e) => setClearExisting(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-purple-500 focus:ring-purple-500"
                />
                <div>
                  <span className="text-sm text-white">
                    Mevcut rezervasyonları temizle
                  </span>
                  <p className="text-xs text-slate-400">
                    Bu etkinlikteki onaylı rezervasyonlar iptal edilir
                  </p>
                </div>
              </label>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("upload");
                    setError(null);
                  }}
                  className="flex-1 h-11 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Geri
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing || matchedCount === 0}
                  className="flex-[2] h-11 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium rounded-xl"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      İçe aktarılıyor...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      {matchedCount} Rezervasyon İçe Aktar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Result */}
          {step === "result" && result && (
            <div className="space-y-4 py-4">
              <div className="text-center space-y-3">
                <div className="w-20 h-20 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white">
                  İçe Aktarma Tamamlandı
                </h3>
                <p className="text-slate-400">
                  <span className="text-emerald-400 font-bold text-lg">
                    {result.created}
                  </span>{" "}
                  rezervasyon oluşturuldu
                  {result.skipped > 0 && (
                    <>
                      ,{" "}
                      <span className="text-amber-400 font-medium">
                        {result.skipped}
                      </span>{" "}
                      atlandı
                    </>
                  )}
                </p>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowErrors(!showErrors)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm text-amber-300 hover:bg-amber-500/10 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {result.errors.length} uyarı/hata
                    </span>
                    <span className="text-xs">
                      {showErrors ? "Gizle" : "Göster"}
                    </span>
                  </button>
                  {showErrors && (
                    <div className="px-4 pb-3 max-h-40 overflow-y-auto space-y-1">
                      {result.errors.map((err, i) => (
                        <p key={i} className="text-xs text-amber-200/70">
                          • {err}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleClose}
                className="w-full h-11 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
              >
                Kapat
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
