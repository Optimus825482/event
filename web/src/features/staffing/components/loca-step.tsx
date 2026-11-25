"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { groupUngroupedLocasAction } from "../actions";
import type { LocaStaffingRow } from "../loca-plan";
import { Section } from "./bits";

/** Loca personel planı: her loca için grup, süpervizör ve atanan personel; grupsuz locaları tek tıkla gruplar. */
export function LocaStep({ rows, eventId, canEdit }: { rows: LocaStaffingRow[]; eventId: string; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const ungrouped = rows.filter((r) => r.groupId === null).length;

  const group = () =>
    startTransition(async () => {
      setMessage(null);
      const res = await groupUngroupedLocasAction({ eventId });
      if (res.ok) {
        setMessage({ kind: "ok", text: `${res.data.created} loca grubu oluşturuldu.` });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: res.message });
      }
    });

  return (
    <Section title="Loca personeli">
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">Bu etkinlikte loca masası yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="py-2 pr-3 font-medium">Loca</th>
                <th className="py-2 pr-3 font-medium">Kat</th>
                <th className="py-2 pr-3 font-medium">Grup</th>
                <th className="py-2 pr-3 font-medium">Süpervizör</th>
                <th className="py-2 font-medium">Personel</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.tableId} className="border-b border-slate-700 text-slate-200 last:border-0">
                  <td className="py-2 pr-3 font-medium">{row.label}</td>
                  <td className="py-2 pr-3">{row.floor}</td>
                  <td className="py-2 pr-3">{row.groupName ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {row.supervisorStaffId
                      ? (row.staff.find((s) => s.staffId === row.supervisorStaffId)?.fullName ?? "Atanmış")
                      : "—"}
                  </td>
                  <td className="py-2">
                    {row.staff.length === 0 ? (
                      <Badge variant="secondary">Personel yok</Badge>
                    ) : (
                      row.staff.map((s) => (s.role ? `${s.fullName} (${s.role})` : s.fullName)).join(", ")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && (
        <div className="mt-3 flex items-center gap-3">
          <Button type="button" variant="outline" onClick={group} disabled={pending || ungrouped === 0}>
            Grupsuz locaları gruplandır
          </Button>
          {message && (
            <span className={message.kind === "ok" ? "text-sm text-slate-400" : "text-sm text-red-400"}>
              {message.text}
            </span>
          )}
        </div>
      )}
    </Section>
  );
}
