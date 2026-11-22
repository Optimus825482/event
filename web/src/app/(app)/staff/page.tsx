import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db/client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { getStaffFormOptions, listStaff } from "@/features/staff/queries";
import { staffFilterSchema } from "@/features/staff/schemas";
import { StaffFilters } from "@/features/staff/components/staff-filters";
import { StaffForm } from "@/features/staff/components/staff-form";

export const metadata: Metadata = { title: "Personel | EventFlow" };

const STATUS_LABELS = { active: "Çalışıyor", inactive: "Pasif", terminated: "Ayrıldı" } as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePolicyActor();
  if (!can(actor, "staff", "view")) {
    return <p className="text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</p>;
  }

  const raw = await searchParams;
  const parsed = staffFilterSchema.safeParse({
    search: first(raw.search) || undefined,
    status: first(raw.status) || undefined,
    departmentId: first(raw.departmentId) || undefined,
    positionId: first(raw.positionId) || undefined,
    workLocationId: first(raw.workLocationId) || undefined,
  });
  const filter = parsed.success ? parsed.data : {};

  const [rows, options] = await Promise.all([listStaff(db, actor, filter), getStaffFormOptions(db, actor)]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Personel</h1>
          <p className="text-sm text-muted-foreground">{rows.length} kişi listeleniyor</p>
        </div>
        {can(actor, "staff", "edit") ? (
          <Link href="/settings/organization" className="text-sm underline underline-offset-4">
            Kuruluş ayarları
          </Link>
        ) : null}
      </div>

      {can(actor, "staff", "create") ? (
        <details className="rounded-md border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">Yeni personel ekle</summary>
          <div className="mt-4">
            <StaffForm options={options} />
          </div>
        </details>
      ) : null}

      <StaffFilters options={options} />

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Kriterlere uyan personel yok.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sicil</TableHead>
              <TableHead>Ad soyad</TableHead>
              <TableHead>Bölüm</TableHead>
              <TableHead>Unvan</TableHead>
              <TableHead>Görev yeri</TableHead>
              <TableHead>Durum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.sicilNo}</TableCell>
                <TableCell>
                  <Link href={`/staff/${row.id}`} className="inline-flex items-center gap-2 font-medium hover:underline">
                    <span
                      aria-hidden
                      className="inline-block size-3 rounded-full"
                      style={{ backgroundColor: row.color ?? "#94a3b8" }}
                    />
                    {row.fullName}
                  </Link>
                </TableCell>
                <TableCell>{row.departmentName ?? "—"}</TableCell>
                <TableCell>{row.positionName ?? "—"}</TableCell>
                <TableCell>{row.workLocationName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "default" : "secondary"}>{STATUS_LABELS[row.status]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
