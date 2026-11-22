"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRunAction } from "@/features/customers/components/use-run-action";
import type { ActionResult } from "@/lib/action";
import type { ImportRowResult, PreviewResult } from "../types";

type CommitResult = { rows: ImportRowResult[] };

type Props = {
  eventId: string;
  templateHref: string;
  /** `true`: tek hata varsa onay kapalı (tüm dosya birlikte yazılır). */
  allOrNothing: boolean;
  previewAction: (raw: unknown) => Promise<ActionResult<PreviewResult>>;
  importAction: (raw: unknown) => Promise<ActionResult<CommitResult>>;
};

function payload(eventId: string, file: File): FormData {
  const data = new FormData();
  data.set("eventId", eventId);
  data.set("file", file);
  return data;
}

type DisplayRow = { row: number; ok: boolean; summary: string; message: string };

function ResultTable({ rows }: { rows: DisplayRow[] }) {
  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Satır</TableHead>
            <TableHead>Özet</TableHead>
            <TableHead className="w-28">Durum</TableHead>
            <TableHead>Ayrıntı</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.row}>
              <TableCell>{r.row}</TableCell>
              <TableCell>{r.summary}</TableCell>
              <TableCell>
                <Badge variant={r.ok ? "secondary" : "destructive"}>{r.ok ? "Uygun" : "Hata"}</Badge>
              </TableCell>
              <TableCell className="whitespace-normal">{r.message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Yükle, önizle (hiçbir şey yazılmaz), onayla. Onayda aynı dosya yeniden gönderilir ve sunucuda
 * yeniden ayrıştırılır; önizleme sonucuna güvenilmez.
 */
export function ImportPanel({ eventId, templateHref, allOrNothing, previewAction, importAction }: Props) {
  const { pending, failure, run, clear } = useRunAction();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    clear();
  }

  const blocked = preview === null || preview.okCount === 0 || (allOrNothing && preview.errorCount > 0);
  const created = result?.rows.filter((r) => r.status === "created").length ?? 0;
  const skipped = result ? result.rows.length - created : 0;

  return (
    <div className="space-y-6">
      {result === null ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (file) run(previewAction, payload(eventId, file), setPreview);
          }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="import-file" className="sr-only">
              Excel dosyası (.xlsx)
            </label>
            <input
              id="import-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="text-sm"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                clear();
              }}
            />
            <Button type="submit" disabled={!file || pending}>
              {pending && preview === null ? "Okunuyor…" : "Önizle"}
            </Button>
            <a href={templateHref} className={buttonVariants({ variant: "outline" })} download>
              Şablonu indir
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Yalnızca .xlsx, en çok 10 MB ve 5000 satır; yalnızca ilk sayfa okunur. Önizlemede hiçbir şey kaydedilmez.
          </p>
        </form>
      ) : null}

      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {failure.message}
        </p>
      ) : null}

      {preview !== null && result === null ? (
        <section aria-labelledby="preview-title" className="space-y-3">
          <h2 id="preview-title" className="text-lg font-medium">
            Önizleme: {preview.okCount} uygun, {preview.errorCount} hatalı satır
          </h2>
          <ResultTable
            rows={preview.rows.map((r) => ({ row: r.row, ok: r.status === "ok", summary: r.summary, message: r.message }))}
          />
          {allOrNothing && preview.errorCount > 0 ? (
            <p role="status" className="text-sm text-destructive">
              Bu içe aktarma tümüyle ya da hiç yazılır: hatalı satırları düzeltip dosyayı yeniden yükleyin.
            </p>
          ) : null}
          {!allOrNothing && preview.errorCount > 0 ? (
            <p role="status" className="text-sm text-muted-foreground">
              Hatalı satırlar atlanır, uygun olanlar oluşturulur. Kesin sonuç onay anında belirlenir (müsaitlik yeniden denetlenir).
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button
              disabled={blocked || pending || !file}
              onClick={() => {
                if (file) run(importAction, payload(eventId, file), setResult);
              }}
            >
              {pending ? "Aktarılıyor…" : "Onayla ve içe aktar"}
            </Button>
            <Button variant="outline" onClick={reset} disabled={pending}>
              Vazgeç
            </Button>
          </div>
        </section>
      ) : null}

      {result !== null ? (
        <section aria-labelledby="result-title" className="space-y-3">
          <h2 id="result-title" className="text-lg font-medium">
            Sonuç: {created} satır işlendi, {skipped} satır atlandı
          </h2>
          <ResultTable
            rows={result.rows.map((r) => ({ row: r.row, ok: r.status === "created", summary: "", message: r.message }))}
          />
          <Button variant="outline" onClick={reset}>
            Yeni dosya yükle
          </Button>
        </section>
      ) : null}
    </div>
  );
}
