import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/ui/PageContainer";
import { SalesSiteList } from "@/features/sales-site/components/sales-site-list";
import { loadSalesSiteOverview } from "@/features/sales-site/loaders";

export const metadata: Metadata = { title: "Satış Sitesi | EventFlow" };

export default async function SalesSitePage() {
  const overview = await loadSalesSiteOverview();

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          title="Satış Sitesi"
          description="Sitede yayınlanan etkinlikler, içerikleri ve satış durumu."
          className="mb-0"
        />
        <SalesSiteList overview={overview} />
      </div>
    </PageContainer>
  );
}
