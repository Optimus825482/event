import type { Metadata } from "next";
import { TableTypeManager } from "@/features/venue/components/table-type-manager";
import { loadTableTypes } from "@/features/venue/queries";

export const metadata: Metadata = { title: "Masa tipleri | EventFlow" };

export default async function TableTypesPage() {
  const { tableTypes, canCreate, canEdit, canDelete } = await loadTableTypes();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Masa tipleri</h1>
        <p className="text-sm text-muted-foreground">
          Yerleşim düzenleyicisinde masalara atanan tipler; renk ve şekil tuvalde kullanılır.
        </p>
      </div>
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
