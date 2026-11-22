"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, EmptyState, Section, hhmm, orNull } from "./bits";
import { useOrganization } from "./store";

/** Adım 4: kadro dışı (geçici) personel; personel kaydı yoktur, ad soyad ile tutulur. */
export function ExtraStaffStep({ readOnly }: { readOnly: boolean }) {
  const extras = useOrganization((s) => s.extraStaff);
  const groups = useOrganization((s) => s.groups);
  const tables = useOrganization((s) => s.reference.tables);
  const add = useOrganization((s) => s.addExtra);
  const update = useOrganization((s) => s.updateExtra);
  const remove = useOrganization((s) => s.removeExtra);
  const toggle = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

  return (
    <Section
      title="Ekstra personel"
      actions={
        readOnly ? null : (
          <Button size="sm" variant="outline" onClick={add}>
            Ekle
          </Button>
        )
      }
    >
      {extras.length === 0 ? (
        <EmptyState>Ekstra personel yok.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {extras.map((e) => (
            <li key={e.id} className="space-y-2 rounded-md border border-border p-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <Input
                  aria-label="Ad soyad"
                  placeholder="Ad soyad"
                  value={e.fullName}
                  disabled={readOnly}
                  onChange={(ev) => update(e.id, { fullName: ev.target.value })}
                />
                <Input
                  aria-label="Unvan"
                  placeholder="Unvan"
                  value={e.position ?? ""}
                  disabled={readOnly}
                  onChange={(ev) => update(e.id, { position: orNull(ev.target.value) })}
                />
                <Input
                  aria-label="Görev"
                  placeholder="Görev"
                  value={e.role ?? ""}
                  disabled={readOnly}
                  onChange={(ev) => update(e.id, { role: orNull(ev.target.value) })}
                />
                <Input
                  type="time"
                  aria-label="Vardiya başlangıcı"
                  value={hhmm(e.shiftStart)}
                  disabled={readOnly}
                  onChange={(ev) => update(e.id, { shiftStart: orNull(ev.target.value) })}
                />
                <Input
                  type="time"
                  aria-label="Vardiya bitişi"
                  value={hhmm(e.shiftEnd)}
                  disabled={readOnly}
                  onChange={(ev) => update(e.id, { shiftEnd: orNull(ev.target.value) })}
                />
              </div>
              <div className="flex flex-wrap gap-1.5" aria-label="Gruplar">
                {groups.map((g) => (
                  <Chip
                    key={g.id}
                    active={e.groupIds.includes(g.id)}
                    color={g.color}
                    disabled={readOnly}
                    onClick={() => update(e.id, { groupIds: toggle(e.groupIds, g.id) })}
                  >
                    {g.name}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5" aria-label="Masalar">
                {tables.map((t) => (
                  <Chip
                    key={t.id}
                    active={e.tableIds.includes(t.id)}
                    disabled={readOnly}
                    onClick={() => update(e.id, { tableIds: toggle(e.tableIds, t.id) })}
                  >
                    {t.label}
                  </Chip>
                ))}
              </div>
              {readOnly ? null : (
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => remove(e.id)}>
                    Kaldır
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
