"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { PREVIEW_LEGEND, previewColor, TemplatePreview } from "./template-preview";
import type { TemplatePermissions, TemplateRow } from "./template-types";

type Props = TemplatePermissions & {
  template: TemplateRow | null;
  pending: boolean;
  onClose: () => void;
  onDuplicate: (t: TemplateRow) => void;
  onEdit: (t: TemplateRow) => void;
  onDelete: (t: TemplateRow) => void;
};

export function TemplateDetailDialog({
  template,
  pending,
  canEdit,
  canDelete,
  canCreate,
  onClose,
  onDuplicate,
  onEdit,
  onDelete,
}: Props) {
  return (
    <Dialog open={template !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-w-2xl">
        {template ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {template.name}
                <Badge variant={template.isPublic ? "default" : "secondary"}>
                  {template.isPublic ? "Herkese açık" : "Özel"}
                </Badge>
              </DialogTitle>
              <DialogDescription>{template.description ?? "Açıklama yok"}</DialogDescription>
            </DialogHeader>
            <TemplatePreview
              model={template.preview}
              showLabels
              title={`${template.name} yerleşim önizlemesi`}
              className="aspect-[3/2] w-full rounded-md border border-slate-600"
            />
            <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label="Gösterge">
              {PREVIEW_LEGEND.map((l) => (
                <li key={l.kind} className="flex items-center gap-1">
                  <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: previewColor(l.kind) }} />
                  {l.label}
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Masa</dt>
                <dd>{template.tableCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Kapasite</dt>
                <dd>{template.capacity} kişi</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Kullanım</dt>
                <dd>{template.usageCount} kez</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Oluşturulma</dt>
                <dd>{formatDate(template.createdAt)}</dd>
              </div>
              {template.createdByName ? (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Oluşturan</dt>
                  <dd>{template.createdByName}</dd>
                </div>
              ) : null}
            </dl>
            <p className="text-xs text-muted-foreground">
              Şablonu uygulamak için bir etkinliğin masa yerleşimi sayfasında &quot;Şablonlar&quot; menüsünü kullanın.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              {canCreate ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => onDuplicate(template)}>
                  Kopyala
                </Button>
              ) : null}
              {canEdit && template.canManage ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => onEdit(template)}>
                  Düzenle
                </Button>
              ) : null}
              {canDelete && template.canManage ? (
                <Button size="sm" variant="destructive" disabled={pending} onClick={() => onDelete(template)}>
                  Sil
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
