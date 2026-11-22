"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogOption } from "../queries";
import { NativeSelect } from "./field";

type Options = { departments: CatalogOption[]; positions: CatalogOption[]; workLocations: CatalogOption[] };

/** Süzgeçler URL'de tutulur; sayfa sunucuda yeniden çizilir. */
export function StaffFilters({ options }: { options: Options }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");

  function apply(next: Record<string, string>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const select = (name: string, label: string, items: CatalogOption[]) => (
    <NativeSelect
      aria-label={label}
      value={params.get(name) ?? ""}
      onChange={(e) => apply({ [name]: e.target.value })}
      className="sm:w-44"
    >
      <option value="">{label}: tümü</option>
      {items.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </NativeSelect>
  );

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ search });
      }}
    >
      <Input
        aria-label="Ara"
        placeholder="Ad veya sicil no ara"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="sm:w-64"
      />
      <Button type="submit" variant="outline">
        Ara
      </Button>
      <NativeSelect
        aria-label="Durum"
        value={params.get("status") ?? ""}
        onChange={(e) => apply({ status: e.target.value })}
        className="sm:w-40"
      >
        <option value="">Durum: tümü</option>
        <option value="active">Çalışıyor</option>
        <option value="inactive">Pasif</option>
        <option value="terminated">Ayrıldı</option>
      </NativeSelect>
      {select("departmentId", "Bölüm", options.departments)}
      {select("positionId", "Unvan", options.positions)}
      {select("workLocationId", "Görev yeri", options.workLocations)}
    </form>
  );
}
