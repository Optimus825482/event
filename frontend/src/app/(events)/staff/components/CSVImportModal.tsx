"use client";

import { useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
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
  const [preview, setPreview] = useState<Array<Record<string, string>>>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headerMap: Record<string, string> = {
    "Sicil No": "sicilNo",
    "İsim Soyisim": "fullName",
    Unvan: "position",
    "Çalıştığı Bölüm": "department",
    "Görev Yeri": "workLocation",
    Mentor: "mentor",
    Cinsiyet: "gender",
    "Doğum Tarihi": "birthDate",
    Yaş: "age",
    "Kan Grubu": "bloodType",
    "Ayakkabı No": "shoeSize",
    "Çorap Bedeni": "sockSize",
    "İşe Giriş Tarihi": "hireDate",
    Kıdem: "yearsAtCompany",
  };

  const parseCSV = (text: string): Array<Record<string, string>> => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      throw new Error(
        "CSV dosyası en az başlık ve bir veri satırı içermelidir"
      );
    }

    const headers = lines[0].split(";").map((h) => h.trim().replace(/"/g, ""));
    const mappedHeaders = headers.map((h) => headerMap[h] || h);

    const data: Array<Record<string, string>> = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(";").map((v) => v.trim().replace(/"/g, ""));
      const row: Record<string, string> = {};
      mappedHeaders.forEach((header, index) => {
        if (values[index]) {
          row[header] = values[index];
        }
      });
      if (row.sicilNo && row.fullName) {
        data.push(row);
      }
    }
    return data;
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
        const data = parseCSV(text);
        setPreview(data.slice(0, 5));
      } catch (err: any) {
        setError(err.message || "CSV dosyası okunamadı");
      }
    };
    reader.readAsText(selectedFile, "UTF-8");
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string;
          const data = parseCSV(text);
          const success = await onImport(data);
          if (success) {
            setFile(null);
            setPreview([]);
            onClose();
          }
        } catch (err: any) {
          setError(err.message || "İçe aktarma başarısız");
        } finally {
          setImporting(false);
        }
      };
      reader.readAsText(file, "UTF-8");
    } catch (err) {
      setError("İçe aktarma başarısız");
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-400" />
            CSV İçe Aktar
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Personel verilerini CSV dosyasından içe aktarın
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload */}
          <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <Upload className="w-10 h-10 mx-auto text-slate-500 mb-2" />
              <p className="text-slate-400">
                {file ? file.name : "CSV dosyası seçin veya sürükleyin"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Beklenen sütunlar: Sicil No, İsim Soyisim, Unvan, Çalıştığı
                Bölüm, Görev Yeri...
              </p>
            </label>
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
                Önizleme ({preview.length} kayıt gösteriliyor)
              </p>
              <div className="border border-slate-700 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-700/50">
                      <TableHead className="text-slate-300">Sicil No</TableHead>
                      <TableHead className="text-slate-300">Ad Soyad</TableHead>
                      <TableHead className="text-slate-300">Pozisyon</TableHead>
                      <TableHead className="text-slate-300">Bölüm</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i} className="border-slate-700">
                        <TableCell className="text-white">
                          {row.sicilNo}
                        </TableCell>
                        <TableCell className="text-white">
                          {row.fullName}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {row.position || "-"}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {row.department || "-"}
                        </TableCell>
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
            disabled={!file || importing}
          >
            {importing ? "İçe Aktarılıyor..." : "İçe Aktar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
