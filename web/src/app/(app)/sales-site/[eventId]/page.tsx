import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/ui/PageContainer";
import { SiteContentForm } from "@/features/sales-site/components/site-content-form";
import { SiteImageField } from "@/features/sales-site/components/site-image-field";
import { SitePreview } from "@/features/sales-site/components/site-preview";
import { SiteTabs } from "@/features/sales-site/components/site-tabs";
import { siteStateLabel } from "@/features/sales-site/labels";
import { loadSiteContent, parseSiteTab } from "@/features/sales-site/loaders";
import { OrdersLive } from "@/features/ticketing/components/orders-table";
import { loadOrdersOverview } from "@/features/ticketing/loaders";

export const metadata: Metadata = { title: "Satış Sitesi Etkinlik | EventFlow" };

export default async function SalesSiteEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ eventId }, query] = await Promise.all([params, searchParams]);
  const { view, canEdit, canSeeOrders } = await loadSiteContent(eventId);
  const tab = parseSiteTab(query.tab, canSeeOrders);

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <Link
            href="/sales-site"
            className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Satış Sitesi
          </Link>
          <PageHeader title={view.eventName} description={siteStateLabel(view.siteState)} className="mb-0" />
        </div>

        <SiteTabs eventId={eventId} active={tab} canSeeOrders={canSeeOrders} />

        {tab === "siparisler" ? (
          <OrdersLive initial={await loadOrdersOverview(eventId)} />
        ) : (
          <div className="space-y-6">
            <SitePreview view={view} />
            <div className="grid gap-4 md:grid-cols-3">
              <SiteImageField eventId={eventId} slot="cover" path={view.coverImage} canEdit={canEdit} />
              <SiteImageField eventId={eventId} slot="hero" path={view.heroImage} canEdit={canEdit} />
              {view.artist !== null ? (
                <SiteImageField eventId={eventId} slot="artist" path={view.artist.image} canEdit={canEdit} />
              ) : (
                <div className="flex items-center rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                  Bu etkinlik bir sanatçı kaydına bağlı değil; sitede hero görseli kullanılır.
                </div>
              )}
            </div>
            <SiteContentForm view={view} canEdit={canEdit} />
          </div>
        )}
      </div>
    </PageContainer>
  );
}
