"use client";

import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActionResult } from "@/lib/action";
import {
  createBlankTemplateAction,
  deleteVenueTemplateAction,
  duplicateVenueTemplateAction,
  updateVenueTemplateAction,
} from "../actions";
import { countTemplateTabs, filterTemplates, type TemplateTab } from "./template-filter";
import { TemplateDetailDialog } from "./template-detail-dialog";
import { TemplateFormDialog, type TemplateFormValues } from "./template-form-dialog";
import { TemplatePreview } from "./template-preview";
import type { TemplatePermissions, TemplateRow } from "./template-types";

type Props = TemplatePermissions & { templates: TemplateRow[] };

export function TemplateList({ templates, canEdit, canDelete, canCreate }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TemplateTab>("all");
  const [detail, setDetail] = useState<TemplateRow | null>(null);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TemplateRow | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const counts = countTemplateTabs(templates, query);
  const visible = filterTemplates(templates, query, tab);

  async function run(task: () => Promise<ActionResult<unknown>>, after?: () => void) {
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await task();
      if (!res.ok) {
        setError(res.message);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      after?.();
      router.refresh();
    } catch {
      setError("Beklenmeyen bir hata oluştu");
    } finally {
      setPending(false);
    }
  }

  function closeForms(open: boolean) {
    if (open) return;
    setEditing(null);
    setCreating(false);
    setError(null);
    setFieldErrors({});
  }

  function submitForm(values: TemplateFormValues) {
    if (editing) {
      const id = editing.id;
      void run(() => updateVenueTemplateAction({ id, ...values }), () => setEditing(null));
    } else {
      void run(() => createBlankTemplateAction(values), () => setCreating(false));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Şablon ara"
            placeholder="Şablon ara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {canCreate ? (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Yeni şablon oluştur
          </Button>
        ) : null}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TemplateTab)}>
        <TabsList>
          <TabsTrigger value="all">Tümü ({counts.all})</TabsTrigger>
          <TabsTrigger value="public">Herkese açık ({counts.public})</TabsTrigger>
          <TabsTrigger value="private">Özel ({counts.private})</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && !editing && !creating ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {templates.length === 0
            ? 'Henüz şablon yok. "Yeni şablon oluştur" ile boş bir şablon açabilir ya da bir etkinliğin masa yerleşiminde yerleşimi şablon olarak kaydedebilirsiniz.'
            : "Aramanıza uyan şablon bulunamadı."}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <li key={t.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => setDetail(t)}
                aria-label={`${t.name} ayrıntıları`}
                className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative bg-gradient-to-br from-slate-700 to-slate-600">
                  <TemplatePreview model={t.preview} title={`${t.name} önizlemesi`} className="aspect-[3/2] w-full" />
                  <Badge variant={t.isPublic ? "default" : "secondary"} className="absolute right-2 top-2">
                    {t.isPublic ? "Herkese açık" : "Özel"}
                  </Badge>
                </div>
                <div className="space-y-1 p-4">
                  <h2 className="font-medium">{t.name}</h2>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{t.description ?? "Açıklama yok"}</p>
                  <p className="text-sm">
                    {t.tableCount} masa · {t.capacity} kişi · {t.usageCount} kez kullanıldı
                  </p>
                  {t.createdByName ? (
                    <p className="text-xs text-muted-foreground">Oluşturan: {t.createdByName}</p>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <TemplateDetailDialog
        template={detail}
        pending={pending}
        canEdit={canEdit}
        canDelete={canDelete}
        canCreate={canCreate}
        onClose={() => setDetail(null)}
        onDuplicate={(t) => void run(() => duplicateVenueTemplateAction({ id: t.id }), () => setDetail(null))}
        onEdit={(t) => {
          setDetail(null);
          setEditing(t);
        }}
        onDelete={(t) => {
          setDetail(null);
          setDeleting(t);
        }}
      />

      <TemplateFormDialog
        open={editing !== null || creating}
        title={editing ? "Şablonu düzenle" : "Yeni şablon oluştur"}
        description={editing ? undefined : "Masasız boş bir şablon açılır; yerleşimi bir etkinlikten şablona kaydedebilirsiniz."}
        initial={editing ? { name: editing.name, description: editing.description ?? "", isPublic: editing.isPublic } : undefined}
        submitLabel={editing ? "Kaydet" : "Oluştur"}
        pending={pending}
        error={error}
        fieldErrors={fieldErrors}
        onOpenChange={closeForms}
        onSubmit={submitForm}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? null : setDeleting(null))}
        title="Şablon silinsin mi?"
        description="Şablonu kullanan etkinliklerin masaları etkilenmez. Bu işlem geri alınamaz."
        confirmText="Sil"
        variant="destructive"
        loading={pending}
        onConfirm={() => {
          const target = deleting;
          if (target) void run(() => deleteVenueTemplateAction({ id: target.id }), () => setDeleting(null));
        }}
      />
    </div>
  );
}
