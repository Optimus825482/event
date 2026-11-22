import { UserRound } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/db/client";
import { can } from "@/features/auth/policy";
import { requirePolicyActor } from "@/features/auth/permissions";
import { SearchForm } from "@/features/customers/components/customer-list";
import { GuestList } from "@/features/customers/components/guest-list";
import { searchCustomers } from "@/features/customers/queries";

export const metadata: Metadata = { title: "Misafirler | EventFlow" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Misafir listesi: her rezervasyon bir müşteriye bağlı olduğundan misafir = müşteri.
 * Notlar "Yeni Not" penceresinden eklenir; geçmiş notlar müşteri sayfasında yönetilir.
 */
export default async function GuestsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePolicyActor();
  if (!can(actor, "customers", "view")) {
    return (
      <p role="alert" className="text-sm text-muted-foreground">
        Bu sayfaya erişim yetkiniz yok.
      </p>
    );
  }

  const params = await searchParams;
  const q = first(params.q)?.trim() || undefined;
  const parsedPage = Number(first(params.page));
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const list = await searchCustomers(db, actor, { q, page });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Misafirler"
        description="Etkinlik öncesi, sırası ve sonrası notları misafir kartından ekleyin."
        icon={<UserRound className="size-8 text-purple-400" />}
      />
      <SearchForm basePath="/guests" q={q} />
      <GuestList list={list} q={q} canAddNote={can(actor, "customers", "edit")} />
    </div>
  );
}
