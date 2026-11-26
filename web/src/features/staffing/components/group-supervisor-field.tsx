"use client";

import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffPicker } from "./staff-picker";
import { useOrganization } from "./store";

/** Süpervizörün adı: etkin personel listesinde yoksa (pasifleşmiş) `fallback`, o da yoksa genel metin; seçilmemişse null. */
export function useSupervisorName(supervisorStaffId: string | null, fallback?: string | null): string | null {
  const staff = useOrganization((s) => s.reference.staff);
  if (!supervisorStaffId) return null;
  return staff.find((p) => p.id === supervisorStaffId)?.fullName ?? fallback ?? "Aktif olmayan personel";
}

/**
 * Masa ya da loca grubunun süpervizörünü seçer (isteğe bağlı, tek kişi). Seçim yalnızca taslağa yazılır;
 * kayıt "Tümünü kaydet" ile yapılır. Süpervizör, grubun personelini değerlendirme yetkisi kazanır.
 */
export function GroupSupervisorField({ groupId, readOnly }: { groupId: string; readOnly: boolean }) {
  const group = useOrganization((s) => s.groups.find((g) => g.id === groupId));
  const hints = useOrganization((s) => s.reference.reviewHints);
  const setSupervisor = useOrganization((s) => s.setGroupSupervisor);
  const name = useSupervisorName(group?.supervisorStaffId ?? null);
  if (!group) return null;

  return (
    <section className="space-y-2" aria-label="Süpervizör">
      <h3 className="text-sm font-medium text-white">Süpervizör</h3>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="min-w-0 break-words text-slate-200">{name ?? "Süpervizör yok"}</span>
        {name && !readOnly ? (
          <Button size="sm" variant="ghost" onClick={() => setSupervisor(group.id, null)}>
            <UserX aria-hidden className="size-4" />
            Süpervizörü kaldır
          </Button>
        ) : null}
      </div>
      {readOnly ? null : (
        <StaffPicker
          compact
          pickLabel="Süpervizör seç"
          hints={hints}
          availability={() => ({ ok: true, existingId: null })}
          onPick={(pick) => setSupervisor(group.id, pick.staffId)}
        />
      )}
    </section>
  );
}
