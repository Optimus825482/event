import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/ui/PageContainer";
import { requirePolicyActor } from "@/features/auth/permissions";
import { EventSectionNav } from "@/features/events/components/event-section-nav";
import { visibleEventSections } from "@/features/events/sections";
import { OrdersLive } from "@/features/ticketing/components/orders-table";
import { loadOrdersOverview } from "@/features/ticketing/loaders";

export const metadata: Metadata = { title: "Siparişler | EventFlow" };

export default async function EventOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Yükleyici yetkisizlikte 403, geçersiz kimlik / olmayan etkinlikte 404 üretir.
  const [overview, actor] = await Promise.all([loadOrdersOverview(id), requirePolicyActor()]);

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <Link
            href={`/events/${id}`}
            className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {overview.eventName}
          </Link>
          <PageHeader title="Siparişler" description="Online bilet siparişleri, masa doluluğu ve satış toplamları." className="mb-0" />
        </div>
        <EventSectionNav eventId={id} sections={visibleEventSections(actor)} active="orders" />
        <OrdersLive initial={overview} />
      </div>
    </PageContainer>
  );
}
