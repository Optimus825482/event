"use client";

import { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  ClipboardPaste,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CSVImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: Array<Record<string, string>>) => Promise<boolean>;
}

export function CSVImportModal({
  open,
  onClose,
  onImport,
}: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [parsedData, setParsedData] = useState<Array<Record<string, string>>>(
    [],
  );
  const [preview, setPreview] = useState<Array<Record<string, string>>>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("paste");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Detect delimiter: tab (from spreadsheet), semicolon, or comma
  const detectDelimiter = (firstLine: string): string => {
    if (firstLine.includes("\t")) return "\t";
    if (firstLine.includes(";")) return ";";
    return ",";
  };

  // Clean header: remove newlines, extra spaces, quotes, BOM
  const cleanHeader = (h: string): string =>
    h
      .replace(/\uFEFF/g, "")
      .replace(/\r/g, "")
      .replace(/\n/g, " ")
      .replace(/"/g, "")
      .trim();

  const parseText = (text: string): Array<Record<string, string>> => {
    const lines = text
      .split(/\r?\n/)
      .filter((line) => line.trim());
    if (lines.length < 2) {
      throw new Error("En az başlık ve bir veri satırı gereklidir");
    }

    const delimiter = detectDelimiter(lines[0]);
    const headers = lines[0].split(delimiter).map(cleanHeader);

    const data: Array<Record<string, string>> = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]
        .split(delimiter)
        .map((v) => v.replace(/"/g, "").trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (values[index]) {
          row[header] = values[index];
        }
      });
      // Accept row if it has at least Sicil No OR İsim Soyisim
      if (row["Sicil No"] || row["İsim Soyisim"]) {
        data.push(row);
      }
    }
    return data;
  };

  const handlePasteChange = (text: string) => {
    setPasteText(text);
    setError(null);
    if (!text.trim()) {
      setPreview([]);
      setParsedData([]);
      return;
    }
    try {
      const data = parseText(text);
      setParsedData(data);
      setPreview(data.slice(0, 5));
      if (data.length === 0) {
        setError(
          'Veri algılanamadı. Başlık satırında "Sicil No" ve "İsim Soyisim" sütunları olmalıdır.',
        );
      }
    } catch (err: any) {
      setError(err.message || "Veri okunamadı");
      setParsedData([]);
      setPreview([]);
    }
  };

  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text/plain");
    if (pasted) {
      e.preventDefault();
      handlePasteChange(pasted);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = parseText(text);
        setParsedData(data);
        setPreview(data.slice(0, 5));
      } catch (err: any) {
        setError(err.message || "CSV dosyası okunamadı");
      }
    };
    reader.readAsText(selectedFile, "UTF-8");
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    setImporting(true);
    try {
      const success = await onImport(parsedData);
      if (success) {
        handleClose();
      }
    } catch (err: any) {
      setError(err.message || "İçe aktarma başarısız");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPasteText("");
    setParsedData([]);
    setPreview([]);
    setError(null);
    setActiveTab("paste");
    onClose();
  };

  const previewHeaders =
    preview.length > 0 ? Object.keys(preview[0]).slice(0, 6) : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-400" />
            Toplu Personel İçe Aktar
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Excel/tablolardan yapıştırın veya CSV dosyası yükleyin
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v);
              setError(null);
              setPreview([]);
              setParsedData([]);
              setFile(null);
              setPasteText("");
            }}
          >
            <TabsList className="grid w-full grid-cols-2 bg-slate-700">
              <TabsTrigger
                value="paste"
                className="data-[state=active]:bg-slate-600 flex items-center gap-2"
              >
                <ClipboardPaste className="w-4 h-4" />
                Panodan Yapıştır
              </TabsTrigger>
              <TabsTrigger
                value="file"
                className="data-[state=active]:bg-slate-600 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Dosya Yükle
              </TabsTrigger>
            </TabsList>

            {/* PASTE TAB */}
            <TabsContent value="paste" className="space-y-3 mt-3">
              <div className="space-y-2">
                <p className="text-sm text-slate-400">
                  Excel&apos;den verileri kopyalayıp (Ctrl+C) aşağıdaki alana
                  yapıştırın (Ctrl+V):
                </p>
                <textarea
                  ref={textareaRef}
                  value={pasteText}
                  onChange={(e) => handlePasteChange(e.target.value)}
                  onPaste={handleTextareaPaste}
                  placeholder={
                    "Sicil No\tİsim Soyisim\tUnvan\tÇalıştığı Bölüm\n1001\tAhmet Yılmaz\tGarson\tServis\n1002\tMehmet Kaya\tAşçı\tMutfak"
                  }
                  className="w-full h-40 bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-white font-mono placeholder:text-slate-600 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none resize-y"
                  spellCheck={false}
                />
                {pasteText && parsedData.length > 0 && (
                  <p className="text-xs text-green-400">
                    {parsedData.length} satır algılandı
                  </p>
                )}
              </div>
            </TabsContent>

            {/* FILE TAB */}
            <TabsContent value="file" className="space-y-3 mt-3">
              <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Upload className="w-10 h-10 mx-auto text-slate-500 mb-2" />
                  <p className="text-slate-400">
                    {file ? file.name : "CSV dosyası seçin"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    .csv veya .txt dosyaları desteklenir
                  </p>
                </label>
              </div>
            </TabsContent>
          </Tabs>

          {/* Beklenen sütunlar bilgisi */}
          <div className="bg-slate-700/40 rounded-lg p-3 text-xs text-slate-400">
            <p className="font-medium text-slate-300 mb-1">
              Beklenen sütunlar:
            </p>
            <p>
              Sicil No, İsim Soyisim, Unvan, Çalıştığı Bölüm, Görev Yeri,
              Miçolar, Cinsiyet, Doğum Tarihi, Yaş, Kan Grubu, Ayakkabı
              Numarası, Kadın Çorap Bedenleri, İşe Giriş Tarihi, Kıdem, Durum
            </p>
          </div>

          {error && (
            <Alert className="bg-red-500/10 border-red-500/30">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <AlertDescription className="text-red-400">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <p className="text-sm text-slate-400 mb-2">
                Önizleme (ilk {preview.length} kayıt, toplam{" "}
                {parsedData.length})
              </p>
              <div className="border border-slate-700 rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-700/50">
                      {previewHeaders.map((h) => (
                        <TableHead
                          key={h}
                          className="text-slate-300 text-xs whitespace-nowrap"
                        >
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i} className="border-slate-700">
                        {previewHeaders.map((h) => (
                          <TableCell
                            key={h}
                            className="text-white text-xs"
                          >
                            {row[h] || "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-slate-600"
          >
            İptal
          </Button>
          <Button
            onClick={handleImport}
            className="bg-green-600 hover:bg-green-700"
            disabled={parsedData.length === 0 || importing}
          >
            {importing
              ? "İçe Aktarılıyor..."
              : `İçe Aktar (${parsedData.length} kayıt)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
