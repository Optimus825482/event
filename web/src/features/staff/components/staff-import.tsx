"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { importStaffCsvAction, previewStaffImportAction } from "../actions/import";
import { FIELD_HEADERS, IMPORT_FIELDS, STAFF_IMPORT_MAX_BYTES, STAFF_IMPORT_MAX_ROWS } from "../csv-import";
import type { StaffImportPreview, StaffImportRow, StaffImportRowStatus } from "../import-service";

const STATUS_BADGE: Record<StaffImportRowStatus, { label: string; variant: "secondary" | "destructive" | "outline" | "default" }> = {
  ok: { label: "Uygun", variant: "secondary" },
  error: { label: "Hata", variant: "destructive" },
  duplicate: { label: "Yinelenen", variant: "outline" },
  created: { label: "Eklendi", variant: "default" },
};

const COLUMN_HINT = IMPORT_FIELDS.map((field) => FIELD_HEADERS[field][0]).join(", ");

function payload(file: File): FormData {
  const data = new FormData();
  data.set("file", file);
  return data;
}

function RowsTable({ rows }: { rows: StaffImportRow[] }) {
  return (
    <div className="max-h-[24rem] overflow-auto rounded-md border border-slate-700">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Satır</TableHead>
            <TableHead>Sicil</TableHead>
            <TableHead>Ad soyad</TableHead>
            <TableHead className="w-28">Durum</TableHead>
            <TableHead>Ayrıntı</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.line}>
              <TableCell>{row.line}</TableCell>
              <TableCell>{row.sicilNo || "—"}</TableCell>
              <TableCell>{row.fullName || "—"}</TableCell>
              <TableCell>
                <Badge variant={STATUS_BADGE[row.status].variant}>{STATUS_BADGE[row.status].label}</Badge>
              </TableCell>
              <TableCell className="whitespace-normal text-xs">{row.messages.join(" · ")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Personel CSV içe aktarma: dosya seç → sunucuda önizle (yazmaz) → geçerli satırları tek işlemde ekle. */
export function StaffImport() {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StaffImportPreview | null>(null);
  const [created, setCreated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setFile(null);
    setPreview(null);
    setCreated(null);
    setError(null);
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    event.target.value = "";
    reset();
    if (!picked) return;
    if (picked.size > STAFF_IMPORT_MAX_BYTES) {
      setError(`Dosya ${STAFF_IMPORT_MAX_BYTES / (1024 * 1024)} MB sınırını aşıyor`);
      return;
    }
    setFile(picked);
    startTransition(async () => {
      const result = await previewStaffImportAction(payload(picked));
      if (result.ok) setPreview(result.data);
      else setError(result.fieldErrors?.file?.[0] ?? result.message);
    });
  }

  function runImport() {
    if (!file) return;
    startTransition(async () => {
      const result = await importStaffCsvAction(payload(file));
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPreview(result.data);
      setCreated(result.data.createdCount);
      const message = `${result.data.createdCount} personel eklendi; ${result.data.duplicateCount} yinelenen, ${result.data.errorCount} hatalı satır atlandı`;
      toast.success(message);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileSpreadsheet aria-hidden className="size-4" />
        CSV içe aktar
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Toplu personel içe aktar</DialogTitle>
            <DialogDescription>
              UTF-8 CSV (ayırıcı ; ya da ,), ilk satır başlık. En fazla {STAFF_IMPORT_MAX_ROWS} satır,{" "}
              {STAFF_IMPORT_MAX_BYTES / (1024 * 1024)} MB. Zorunlu sütunlar: Sicil No, İsim Soyisim.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-slate-400">Tanınan sütunlar: {COLUMN_HINT}.</p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={onPick}
            />
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
              <Upload aria-hidden className="size-4" />
              CSV dosyası seç
            </Button>
            {file ? <span className="text-sm text-slate-300">{file.name}</span> : null}
            {pending ? <span className="text-sm text-slate-400">İşleniyor…</span> : null}
          </div>
          <p role="alert" className={error ? "text-sm text-red-400" : "sr-only"}>
            {error}
          </p>
          {preview ? (
            <div className="space-y-3">
              <p role="status" className="text-sm text-slate-300">
                {created !== null
                  ? `${created} personel eklendi; ${preview.duplicateCount} yinelenen ve ${preview.errorCount} hatalı satır atlandı.`
                  : `${preview.okCount} uygun, ${preview.duplicateCount} yinelenen, ${preview.errorCount} hatalı satır.`}
                {preview.emptyRows > 0 ? ` ${preview.emptyRows} boş satır atlandı.` : ""}
              </p>
              {preview.ignoredColumns.length > 0 ? (
                <p className="text-xs text-amber-400">İçe aktarılmayan sütunlar: {preview.ignoredColumns.join(", ")}</p>
              ) : null}
              <RowsTable rows={preview.rows} />
              {created === null ? (
                <div className="flex justify-end">
                  <Button type="button" disabled={pending || preview.okCount === 0} onClick={runImport}>
                    {preview.okCount} satırı içe aktar
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
