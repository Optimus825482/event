import type { Metadata } from "next";
import { db } from "@/db/client";
import { can } from "@/features/auth/policy";
import { requirePolicyActor } from "@/features/auth/permissions";
import { CustomerList, SearchForm } from "@/features/customers/components/customer-list";
import { searchCustomers } from "@/features/customers/queries";

export const metadata: Metadata = { title: "Misafirler | EventFlow" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Misafir listesi: her rezervasyon bir müşteriye bağlı olduğundan misafir = müşteri.
 * Not sayısı görünür; notlar müşteri sayfasında yönetilir.
 */
export default async function GuestsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePolicyActor();
  if (!can(actor, "customers", "view")) {
    return <p className="text-sm text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</p>;
  }

  const params = await searchParams;
  const q = first(params.q)?.trim() || undefined;
  const parsedPage = Number(first(params.page));
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const list = await searchCustomers(db, actor, { q, page });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Misafirler</h1>
        <p className="text-sm text-muted-foreground">
          Misafir notları için bir kaydı açın; etkinlik öncesi, sırası ve sonrası notları orada tutulur.
        </p>
      </div>
      <SearchForm basePath="/guests" q={q} />
      <CustomerList list={list} basePath="/guests" q={q} showReservations={false} />
    </div>
  );
}
