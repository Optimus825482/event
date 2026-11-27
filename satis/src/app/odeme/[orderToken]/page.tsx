import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CheckoutSteps } from "@/components/checkout-steps";
import { Notice } from "@/components/ui/notice";
import { demoNoticeFor, saleIsDemo } from "@/features/checkout/demo";
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
      <main className="page-gutter mx-auto max-w-[1180px] py-10">
        <Notice tone="error">{messageFor(error)}</Notice>
      </main>
    );
  }
  const serverNow = new Date().toISOString();

  if (order.status === "paid") redirect(`/bilet/${orderToken}`);

  if (order.status === "expired") {
    return (
      <main className="page-gutter mx-auto max-w-3xl py-10">
        <ExpiredView eventId={order.eventId} />
      </main>
    );
  }

  const event = await loadEvent(order.eventId);
  const demoNotice = demoNoticeFor(order, saleIsDemo(event));
  const categoryLabels = Object.fromEntries((event?.prices ?? []).map((p) => [p.category, p.label]));

  return (
    <main className="page-gutter mx-auto max-w-[1180px] space-y-6 py-10">
      <CheckoutSteps current="odeme" />
      <h1 className="m-0 text-[clamp(34px,5vw,56px)] text-ivory">Ödeme</h1>
      <div className="grid grid-cols-1 items-start gap-8 min-[860px]:grid-cols-[0.9fr_1.1fr]">
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
      </div>
    </main>
  );
}
