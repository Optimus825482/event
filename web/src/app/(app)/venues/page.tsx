import type { Metadata } from "next";
import { buildTemplatePreview } from "@/features/venue/components/template-preview-model";
import { TemplateList } from "@/features/venue/components/template-list";
import { loadVenueTemplates } from "@/features/venue/queries";

export const metadata: Metadata = { title: "Mekân şablonları | EventFlow" };

export default async function VenuesPage() {
  const { templates, canEdit, canDelete, canCreate } = await loadVenueTemplates();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Mekân şablonları</h1>
        <p className="text-sm text-muted-foreground">
          Kayıtlı masa yerleşimleri. Bir etkinliğin masa yerleşimi sayfasından uygulanabilir.
        </p>
      </div>
      <TemplateList
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          isPublic: t.isPublic,
          usageCount: t.usageCount,
          tableCount: t.tableCount,
          capacity: t.capacity,
          createdByName: t.createdByName,
          canManage: t.canManage,
          createdAt: t.createdAt.toISOString(),
          preview: buildTemplatePreview(t.layout),
        }))}
        canEdit={canEdit}
        canDelete={canDelete}
        canCreate={canCreate}
      />
    </div>
  );
}
