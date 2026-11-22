import type { Metadata } from "next";
import { db } from "@/db/client";
import { can } from "@/features/auth/policy";
import { requirePolicyActor } from "@/features/auth/permissions";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { CustomerList, SearchForm } from "@/features/customers/components/customer-list";
import { searchCustomers } from "@/features/customers/queries";

export const metadata: Metadata = { title: "Müşteriler | EventFlow" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
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
        <h1 className="text-2xl font-semibold">Müşteriler</h1>
        <p className="text-sm text-muted-foreground">Rezervasyon alan misafirlerin kayıtları.</p>
      </div>
      <SearchForm basePath="/customers" q={q} />
      <CustomerList list={list} basePath="/customers" q={q} showReservations />
      {can(actor, "customers", "create") ? (
        <section aria-labelledby="new-customer" className="space-y-3 rounded-(--radius) border border-border p-4">
          <h2 id="new-customer" className="text-lg font-medium">
            Yeni müşteri
          </h2>
          <CustomerForm />
        </section>
      ) : null}
    </div>
  );
}
