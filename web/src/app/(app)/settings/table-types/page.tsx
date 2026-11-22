import type { Metadata } from "next";
import { LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TableTypeManager } from "@/features/venue/components/table-type-manager";
import { loadTableTypes } from "@/features/venue/queries";

export const metadata: Metadata = { title: "Masa tipleri | EventFlow" };

export default async function TableTypesPage() {
  const { tableTypes, canCreate, canEdit, canDelete } = await loadTableTypes();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Masa tipleri"
        description="Yerleşim düzenleyicisinde masalara atanan tipler; renk ve şekil tuvalde kullanılır."
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <LayoutGrid className="h-5 w-5" aria-hidden="true" />
          </div>
        }
        className="mb-0"
      />
      <TableTypeManager
        tableTypes={tableTypes.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          shape: t.shape,
          capacity: t.capacity,
          basePrice: t.basePrice,
          currency: t.currency,
          minSpacing: t.minSpacing,
          isActive: t.isActive,
          usageCount: t.usageCount,
        }))}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
