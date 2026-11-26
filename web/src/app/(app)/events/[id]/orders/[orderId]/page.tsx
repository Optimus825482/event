import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/ui/PageContainer";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { OrderDetailView } from "@/features/ticketing/components/order-detail";
import { loadOrderDetail } from "@/features/ticketing/loaders";
import { formatPnr } from "@/features/ticketing/pnr";

export const metadata: Metadata = { title: "Sipariş | EventFlow" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string; orderId: string }> }) {
  const { id, orderId } = await params;
  const [detail, actor] = await Promise.all([loadOrderDetail(id, orderId), requirePolicyActor()]);

  const qrImages: Record<string, string> = {};
  for (const ticket of detail.tickets) {
    if (ticket.status === "issued" && ticket.qrPayload) {
      qrImages[ticket.ticketId] = await QRCode.toDataURL(ticket.qrPayload, { width: 280, margin: 1 });
    }
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <Link
            href={`/events/${id}/orders`}
            className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Siparişler
          </Link>
          <PageHeader
            title={detail.pnr ? `Sipariş ${formatPnr(detail.pnr)}` : "Sipariş"}
            description="Alıcı bilgisi, ödeme denemeleri ve biletler."
            className="mb-0"
          />
        </div>
        <OrderDetailView detail={detail} qrImages={qrImages} canResend={can(actor, "ticketing", "edit")} />
      </div>
    </PageContainer>
  );
}
