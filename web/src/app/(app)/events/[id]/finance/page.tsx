import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/ui/PageContainer";
import { requirePolicyActor } from "@/features/auth/permissions";
import { EventSectionNav } from "@/features/events/components/event-section-nav";
import { visibleEventSections } from "@/features/events/sections";
import { FinanceView } from "@/features/finance/components/finance-view";
import { loadFinancePage } from "@/features/finance/overview";
import { PlanningStagePanel } from "@/features/planning/components/stage-panel";
import { loadPlanningPanel } from "@/features/planning/queries";

export const metadata: Metadata = { title: "Finans | EventFlow" };

export default async function EventFinancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // `loadFinancePage` geçersiz kimlik / olmayan etkinlikte 404, yetkisizlikte 403 üretir;
  // `loadPlanningPanel` bu durumlarda `null` döner, böylece paralel çağrı 500 doğurmaz.
  const [overview, planning, actor] = await Promise.all([
    loadFinancePage(id),
    loadPlanningPanel(id),
    requirePolicyActor(),
  ]);

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <Link
            href={`/events/${id}`}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {overview.event.name}
          </Link>
          <PageHeader title="Finans" description="Gider ve gelir kalemleri, hedef kâr ve bilet fiyatları." className="mb-0" />
        </div>
        <EventSectionNav eventId={id} sections={visibleEventSections(actor)} active="finance" />
        {planning ? <PlanningStagePanel state={planning} compact /> : null}
        <FinanceView overview={overview} />
      </div>
    </PageContainer>
  );
}
