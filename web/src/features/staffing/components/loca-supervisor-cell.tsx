"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GroupSupervisorField, SupervisorLabel, useSupervisorInfo } from "./group-supervisor-field";
import { useOrganization } from "./store";

/**
 * Loca tablosunun süpervizör hücresi: taslaktaki seçimi gösterir (kayıtlı değer yalnızca grup taslakta yoksa),
 * düzenlenebilirse grubun süpervizörünü seçtiren pencereyi açar.
 */
export function LocaSupervisorCell({
  groupId,
  groupName,
  savedName,
  canEdit,
}: {
  groupId: string | null;
  groupName: string | null;
  savedName: string | null;
  canEdit: boolean;
}) {
  const group = useOrganization((s) => (groupId ? s.groups.find((g) => g.id === groupId) : undefined));
  const info = useSupervisorInfo(group?.supervisorStaffId ?? null, savedName);
  if (!groupId) return <>—</>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {group ? info ? <SupervisorLabel info={info} /> : <span>—</span> : <span className="min-w-0 break-words">{savedName ?? "—"}</span>}
      {canEdit && group ? (
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" aria-label={`${groupName ?? "Loca grubu"} süpervizörünü değiştir`}>
              Değiştir
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{groupName ?? "Loca grubu"} — Süpervizör</DialogTitle>
              <DialogDescription>Seçim taslağa yazılır; &quot;Tümünü kaydet&quot; ile kaydedilir.</DialogDescription>
            </DialogHeader>
            <GroupSupervisorField groupId={groupId} readOnly={false} />
          </DialogContent>
        </Dialog>
      ) : null}
    </span>
  );
}
