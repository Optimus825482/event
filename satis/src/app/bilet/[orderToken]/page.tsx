import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CheckoutSteps } from "@/components/checkout-steps";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { demoNoticeFor, saleIsDemo } from "@/features/checkout/demo";
import { isOrderTokenShape } from "@/features/checkout/token";
import { getReader } from "@/features/plan/read";
import { formatPnr } from "@/features/ticket/pnr";
import { qrDataUrl } from "@/features/ticket/qr";
import { TicketCard } from "@/features/ticket/ticket-card";
import { getCore } from "@/lib/core/client";
import type { EventDetail, OrderResponse } from "@/lib/core/contract";
import { CoreError, messageFor } from "@/lib/core/errors";
import { formatEventWhen } from "@/lib/time-zone";

// Sipariş belirteçli sayfa: her istekte çekirdekten okunur; başlıkları (noindex, no-store) proxy ekler.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "E-bilet", robots: { index: false, follow: false } };

type PageProps = { params: Promise<{ orderToken: string }> };

async function loadEvent(eventId: string): Promise<EventDetail | null> {
  try {
    return await getReader().event(eventId);
  } catch {
    return null; // etkinlik bilgisi yalnızca DEMO ibaresi için ek; bilet onsuz da gösterilir
  }
}

export default async function TicketPage({ params }: PageProps) {
  const { orderToken } = await params;
  if (!isOrderTokenShape(orderToken)) notFound();

  let order: OrderResponse;
  try {
    order = await getCore().getOrder(orderToken);
  } catch (error) {
    if (!(error instanceof CoreError)) throw error;
    if (error.code === "order_not_found") notFound();
    return (
      <main className="page-gutter mx-auto max-w-3xl py-10">
        <Notice tone="error">{messageFor(error)}</Notice>
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href={`/bilet/${orderToken}`} variant="gold">
            Yeniden dene
          </ButtonLink>
          <ButtonLink href="/" variant="glass">
            Ana sayfa
          </ButtonLink>
        </div>
      </main>
    );
  }

  if (order.status === "pending") redirect(`/odeme/${orderToken}`);

  if (order.status === "expired") {
    return (
      <main className="page-gutter mx-auto flex max-w-3xl flex-col items-start gap-4 py-10">
        <h1 className="m-0 text-[clamp(34px,5vw,56px)] text-ivory">Bu siparişin süresi doldu</h1>
        <Notice>Ödeme tamamlanmadığı için masalar serbest bırakıldı.</Notice>
        <ButtonLink href="/" variant="gold">
          Ana sayfaya dön
        </ButtonLink>
      </main>
    );
  }

  const event = await loadEvent(order.eventId);
  const demoNotice = demoNoticeFor(order, saleIsDemo(event));
  const qrs = await Promise.all(order.tickets.map((ticket) => qrDataUrl(ticket.qrPayload)));

  return (
    <main className="page-gutter mx-auto flex max-w-4xl flex-col gap-5 py-10">
      <CheckoutSteps current="bilet" />
      <h1 className="m-0 text-[clamp(34px,5vw,56px)] text-ivory">E-biletiniz</h1>
      {order.pnr ? (
        <p className="m-0 select-all font-serif text-3xl tracking-widest text-gold-bright">{`PNR ${formatPnr(order.pnr)}`}</p>
      ) : null}
      <section aria-label="Etkinlik" className="flex flex-col gap-1 rounded-[16px] border border-line bg-surface p-4">
        <h2 className="m-0 text-2xl text-ivory">{order.eventName}</h2>
        <p className="m-0 text-sm text-muted">{formatEventWhen(order.startsAt)}</p>
      </section>
      {demoNotice ? <Notice tone="demo">{demoNotice}</Notice> : null}
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
        {order.tickets.map((ticket, i) => (
          <TicketCard
            key={ticket.ticketId}
            index={i + 1}
            total={order.tickets.length}
            tableLabel={ticket.tableLabel}
            seatNo={ticket.seatNo}
            qrSrc={qrs[i]!}
          />
        ))}
      </ul>
      <p className="m-0 text-ivory">Girişte her misafir kendi QR kodunu okutur. E-biletiniz e-posta adresinize de gönderildi.</p>
      <p className="m-0 text-muted">Bu sayfanın bağlantısı biletinizdir; yalnızca birlikte geleceğiniz kişilerle paylaşın.</p>
    </main>
  );
}
