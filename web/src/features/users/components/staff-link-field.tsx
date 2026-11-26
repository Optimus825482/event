"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { LinkableStaff } from "../queries";
import { Field, SELECT_CLASS } from "./field";

export const NOT_LINKED_LABEL = "Bağlı değil";

/** Arama metnine (ad ya da sicil no) uyanlar; seçili kayıt aramadan bağımsız her zaman listede kalır. */
export function filterLinkable(
  options: readonly LinkableStaff[],
  query: string,
  selectedId: string | null,
): LinkableStaff[] {
  const q = query.trim().toLocaleLowerCase("tr");
  if (!q) return [...options];
  return options.filter(
    (o) =>
      o.id === selectedId ||
      o.fullName.toLocaleLowerCase("tr").includes(q) ||
      o.sicilNo.toLocaleLowerCase("tr").includes(q),
  );
}

/**
 * "Personel kaydı" alanı: kullanıcı hesabını bir personel kaydına bağlar (kaptan, şef ve kısım
 * sorumlusu değerlendirmeleri bu bağa dayanır). Başka hesaba bağlı kayıtlar seçilemez.
 */
export function StaffLinkField({
  options,
  value,
  onChange,
  selfId,
  errors,
}: {
  options: readonly LinkableStaff[];
  value: string | null;
  onChange: (staffId: string | null) => void;
  /** Düzenlenen hesap: kendi bağlı kaydı seçilebilir kalır. */
  selfId?: string;
  errors?: string[];
}) {
  const [query, setQuery] = useState("");
  const shown = filterLinkable(options, query, value);
  return (
    <Field
      id="staffId"
      label="Personel kaydı"
      errors={errors}
      hint="Kaptan, şef ve kısım sorumlusu değerlendirmeleri için hesabın personel kaydı gerekir"
    >
      <Input
        type="search"
        aria-label="Personel kaydı ara"
        placeholder="Ad ya da sicil no ara"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      <select
        id="staffId"
        name="staffId"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">{NOT_LINKED_LABEL}</option>
        {shown.map((o) => {
          const takenBy = o.linkedUserId !== null && o.linkedUserId !== selfId ? o.linkedUserName : null;
          return (
            <option key={o.id} value={o.id} disabled={takenBy !== null}>
              {`${o.fullName} (${o.sicilNo})${takenBy ? ` · ${takenBy} hesabına bağlı` : ""}`}
            </option>
          );
        })}
      </select>
    </Field>
  );
}
