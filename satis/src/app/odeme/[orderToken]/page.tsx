import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Notice } from "@/components/ui/notice";
import { demoNoticeFor } from "@/features/checkout/demo";
import { ExpiredView } from "@/features/checkout/expired-view";
import { OrderSummary } from "@/features/checkout/order-summary";
import { PaymentForm } from "@/features/checkout/payment-form";
import { isOrderTokenShape } from "@/features/checkout/token";
import { getReader } from "@/features/plan/read";
import { getCore } from "@/lib/core/client";
import type { EventDetail, OrderResponse } from "@/lib/core/contract";
import { CoreError, messageFor } from "@/lib/core/errors";

// Sipariş belirteçli sayfa: her istekte çekirdekten okunur; başlıkları (noindex, no-store) proxy ekler.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Ödeme", robots: { index: false, follow: false } };

type PageProps = { params: Promise<{ orderToken: string }> };

async function loadEvent(eventId: string): Promise<EventDetail | null> {
  try {
    return await getReader().event(eventId);
  } catch {
    return null; // etkinlik bilgisi yalnızca ek (kategori adı, demo ibaresi); ödeme onsuz da sürer
  }
}

export default async function CheckoutPage({ params }: PageProps) {
  const { orderToken } = await params;
  if (!isOrderTokenShape(orderToken)) notFound();

  let order: OrderResponse;
  try {
    order = await getCore().getOrder(orderToken);
  } catch (error) {
    if (!(error instanceof CoreError)) throw error;
    if (error.code === "order_not_found") notFound();
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Notice tone="error">{messageFor(error)}</Notice>
      </main>
    );
  }
  const serverNow = new Date().toISOString();

  if (order.status === "paid") redirect(`/bilet/${orderToken}`);

  if (order.status === "expired") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <ExpiredView eventId={order.eventId} />
      </main>
    );
  }

  const event = await loadEvent(order.eventId);
  const demoNotice = demoNoticeFor(order, event?.sale.demo ?? false);
  const categoryLabels = Object.fromEntries((event?.prices ?? []).map((p) => [p.category, p.label]));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="m-0 text-3xl font-semibold text-gold">Ödeme</h1>
      <OrderSummary order={order} categoryLabels={categoryLabels} />
      <PaymentForm
        orderToken={orderToken}
        eventId={order.eventId}
        holdExpiresAt={order.holdExpiresAt}
        serverNow={serverNow}
        demo={demoNotice !== null}
      >
        {demoNotice ? <Notice tone="demo">{demoNotice}</Notice> : null}
      </PaymentForm>
    </main>
  );
}
