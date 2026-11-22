"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, EmptyState, NativeSelect, Section, Swatch } from "./bits";
import { useOrganization } from "./store";

/** Adım 2: ekipler (üyeler, lider) ve grup ↔ ekip bağları. Bir grup tek ekibe bağlanır. */
export function TeamsStep({ readOnly }: { readOnly: boolean }) {
  const teams = useOrganization((s) => s.teams);
  const groups = useOrganization((s) => s.groups);
  const staff = useOrganization((s) => s.reference.staff);
  const addTeam = useOrganization((s) => s.addTeam);
  const updateTeam = useOrganization((s) => s.updateTeam);
  const removeTeam = useOrganization((s) => s.removeTeam);
  const toggleMember = useOrganization((s) => s.toggleMember);
  const setGroupTeam = useOrganization((s) => s.setGroupTeam);

  return (
    <div className="space-y-4">
      <Section
        title="Ekipler"
        actions={
          readOnly ? null : (
            <Button size="sm" variant="outline" onClick={addTeam}>
              Ekip ekle
            </Button>
          )
        }
      >
        {teams.length === 0 ? (
          <EmptyState>Henüz ekip yok.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {teams.map((team) => (
              <li key={team.id} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Swatch color={team.color} />
                  <Input
                    aria-label="Ekip adı"
                    className="max-w-xs"
                    value={team.name}
                    disabled={readOnly}
                    onChange={(e) => updateTeam(team.id, { name: e.target.value })}
                  />
                  <input
                    type="color"
                    aria-label="Ekip rengi"
                    value={team.color}
                    disabled={readOnly}
                    onChange={(e) => updateTeam(team.id, { color: e.target.value })}
                    className="h-9 w-10 rounded border border-input"
                  />
                  <NativeSelect
                    aria-label="Ekip lideri"
                    className="max-w-xs"
                    value={team.leaderStaffId ?? ""}
                    disabled={readOnly}
                    onChange={(e) => updateTeam(team.id, { leaderStaffId: e.target.value || null })}
                  >
                    <option value="">Lider yok</option>
                    {team.members.map((m) => (
                      <option key={m.staffId} value={m.staffId}>
                        {staff.find((s) => s.id === m.staffId)?.fullName ?? "Bilinmeyen personel"}
                      </option>
                    ))}
                  </NativeSelect>
                  {readOnly ? null : (
                    <Button size="sm" variant="ghost" onClick={() => removeTeam(team.id)}>
                      Sil
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5" aria-label={`${team.name} üyeleri`}>
                  {staff.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Aktif personel yok.</span>
                  ) : (
                    staff.map((p) => (
                      <Chip
                        key={p.id}
                        active={team.members.some((m) => m.staffId === p.id)}
                        color={team.color}
                        disabled={readOnly}
                        onClick={() => toggleMember(team.id, p.id)}
                      >
                        {p.fullName}
                      </Chip>
                    ))
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Grup → ekip">
        {groups.length === 0 ? (
          <EmptyState>Önce masa grubu oluşturun.</EmptyState>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                <Swatch color={g.color} />
                <span className="flex-1">
                  {g.name} <span className="text-muted-foreground">({g.tableIds.length} masa)</span>
                </span>
                <NativeSelect
                  aria-label={`${g.name} ekibi`}
                  className="max-w-[12rem]"
                  value={g.teamId ?? ""}
                  disabled={readOnly}
                  onChange={(e) => setGroupTeam(g.id, e.target.value || null)}
                >
                  <option value="">Ekip yok</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
