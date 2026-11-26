"use client";

import { UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StaffPicker } from "./staff-picker";
import { useOrganization } from "./store";

export type SupervisorInfo = { name: string; inactive: boolean };

/**
 * Süpervizörün adı ve durumu. Etkin personel listesinde yoksa (pasifleşmiş) kayıtlı gerçek adı `Pasif` işaretiyle
 * döner; kayıtlı ad da yoksa `fallback`, o da yoksa genel metin. Seçilmemişse null.
 */
export function useSupervisorInfo(supervisorStaffId: string | null, fallback?: string | null): SupervisorInfo | null {
  const staff = useOrganization((s) => s.reference.staff);
  const names = useOrganization((s) => s.reference.supervisorNames);
  if (!supervisorStaffId) return null;
  const active = staff.find((p) => p.id === supervisorStaffId);
  if (active) return { name: active.fullName, inactive: false };
  return { name: names?.[supervisorStaffId] ?? fallback ?? "Bilinmeyen personel", inactive: true };
}

/** Ad ve (pasifse) "Pasif" rozeti. */
export function SupervisorLabel({ info }: { info: SupervisorInfo }) {
  return (
    <>
      <span className="min-w-0 break-words">{info.name}</span>
      {info.inactive ? <Badge variant="secondary">Pasif</Badge> : null}
    </>
  );
}

/**
 * Masa ya da loca grubunun süpervizörünü seçer (isteğe bağlı, tek kişi). Seçim yalnızca taslağa yazılır;
 * kayıt "Tümünü kaydet" ile yapılır. Süpervizör, grubun personelini değerlendirme yetkisi kazanır.
 */
export function GroupSupervisorField({ groupId, readOnly }: { groupId: string; readOnly: boolean }) {
  const group = useOrganization((s) => s.groups.find((g) => g.id === groupId));
  const hints = useOrganization((s) => s.reference.reviewHints);
  const setSupervisor = useOrganization((s) => s.setGroupSupervisor);
  const info = useSupervisorInfo(group?.supervisorStaffId ?? null);
  if (!group) return null;

  return (
    <section className="space-y-2" aria-label="Süpervizör">
      <h3 className="text-sm font-medium text-white">Süpervizör</h3>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
        {info ? <SupervisorLabel info={info} /> : <span>Süpervizör yok</span>}
        {info && !readOnly ? (
          <Button size="sm" variant="ghost" onClick={() => setSupervisor(group.id, null)}>
            <UserX aria-hidden className="size-4" />
            Süpervizörü kaldır
          </Button>
        ) : null}
      </div>
      {readOnly ? null : (
        <StaffPicker
          compact
          selectedId={group.supervisorStaffId}
          pickLabel="Süpervizör seç"
          hints={hints}
          availability={() => ({ ok: true, existingId: null })}
          onPick={(pick) => setSupervisor(group.id, pick.staffId)}
        />
      )}
    </section>
  );
}
