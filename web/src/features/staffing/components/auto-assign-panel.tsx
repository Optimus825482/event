"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AutoAssignStrategy } from "../schemas";
import { Chip, NativeSelect, Section } from "./bits";
import { useOrganization } from "./store";

const STRATEGY_LABELS: Record<AutoAssignStrategy, string> = {
  balanced: "Dengeli (masa sırasına göre)",
  zone: "Bölgesel (konuma göre)",
  random: "Rastgele (tohumlu)",
};

/**
 * Otomatik masa dağıtımı taslağa uygulanır (kaydetmez); localar dağıtılmaz. Seçili personelin
 * bu vardiyadaki masa ataması varsa masaları değişir, yoksa yeni masa ataması eklenir.
 */
export function AutoAssignPanel() {
  const staff = useOrganization((s) => s.reference.staff);
  const shifts = useOrganization((s) => s.reference.shifts);
  const locaCount = useOrganization((s) => s.reference.tables.filter((t) => t.isLoca).length);
  const autoAssign = useOrganization((s) => s.autoAssign);
  const [selected, setSelected] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<AutoAssignStrategy>("balanced");
  const [shiftId, setShiftId] = useState("");
  const [seed, setSeed] = useState("1");

  const toggle = (id: string) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Section title="Otomatik dağıtım">
      <p className="text-xs text-muted-foreground">
        Localar ({locaCount}) dağıtıma katılmaz. Sonuç taslağa yazılır; kalıcı olması için Özet adımında kaydedin.
      </p>
      <div className="flex flex-wrap gap-1.5" aria-label="Dağıtıma katılacak personel">
        {staff.map((p) => (
          <Chip key={p.id} active={selected.includes(p.id)} onClick={() => toggle(p.id)}>
            {p.fullName}
          </Chip>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <NativeSelect
          aria-label="Strateji"
          value={strategy}
          onChange={(e) => {
            const next = (["balanced", "zone", "random"] as const).find((s) => s === e.target.value);
            if (next) setStrategy(next);
          }}
        >
          {Object.entries(STRATEGY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Vardiya" value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
          <option value="">Vardiyasız</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        {strategy === "random" ? (
          <Input
            aria-label="Tohum"
            type="number"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
          />
        ) : (
          <span />
        )}
        <Button
          disabled={selected.length === 0}
          onClick={() => {
            const parsedSeed = Number.parseInt(seed, 10);
            autoAssign(selected, strategy, shiftId || null, Number.isFinite(parsedSeed) ? parsedSeed : undefined);
          }}
        >
          Dağıt ({selected.length} personel)
        </Button>
      </div>
    </Section>
  );
}
