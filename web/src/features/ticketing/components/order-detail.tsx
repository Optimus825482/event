import { SALE_CATEGORY_LABELS } from "@/domain/seating";
import { DEMO_NOTICE } from "@/features/sales-api/contract";
import { cn, formatDate } from "@/lib/utils";
import { formatPnr } from "../pnr";
import type { OrderDetail } from "../queries";
import { formatMoney } from "../view-model";
import { DemoBadge, DemoNotice, OrderStatusBadge } from "./badges";
import { ResendButton } from "./resend-button";

const TICKET_STATUS = {
  held: { label: "Tutuluyor", tone: "border-amber-400/50 bg-amber-500/15 text-amber-300" },
  issued: { label: "Kesildi", tone: "border-emerald-400/50 bg-emerald-500/15 text-emerald-300" },
  expired: { label: "Süresi doldu", tone: "border-border text-muted-foreground" },
} as const;

const OUTCOME_LABELS = { approved: "Onaylandı", declined: "Reddedildi", error: "Hata" } as const;

const cardClass = "min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground";

/** Sipariş ayrıntısı. Sunucu bileşenidir; QR görselleri sayfada üretilip `qrImages` ile gelir. */
export function OrderDetailView({
  detail,
  qrImages,
  canResend,
}: {
  detail: OrderDetail;
  qrImages: Record<string, string>;
  canResend: boolean;
}) {
  return (
    <div className="min-w-0 space-y-6">
      {detail.isDemo ? <DemoNotice text={DEMO_NOTICE} /> : null}

      <section aria-labelledby="order-summary-heading" className={cardClass}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="order-summary-heading" className="font-mono text-lg font-semibold">
            {detail.pnr ? formatPnr(detail.pnr) : "PNR yok"}
          </h2>
          <OrderStatusBadge status={detail.status} />
          {detail.isDemo ? <DemoBadge /> : null}
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Alıcı" value={detail.buyerName ?? "—"} />
          <Field label="E-posta" value={detail.buyerEmail ?? "—"} />
          <Field label="Telefon" value={detail.buyerPhone ?? "—"} />
          <Field label="Tutar" value={formatMoney(detail.total, detail.currency)} />
          <Field label="Masalar" value={detail.tableLabels.join(", ") || "—"} />
          <Field label="Adet" value={String(detail.seatCount)} />
          <Field label="Oluşturulma" value={formatDate(detail.createdAt, "datetime")} />
          <Field label="Ödeme zamanı" value={detail.paidAt ? formatDate(detail.paidAt, "datetime") : "—"} />
          <Field label="E-bilet gönderimi" value={detail.eticketSentAt ? formatDate(detail.eticketSentAt, "datetime") : "Gönderilmedi"} />
        </dl>
        {canResend && detail.status === "paid" ? <ResendButton orderId={detail.orderId} /> : null}
      </section>

      <section aria-labelledby="order-attempts-heading" className={cardClass}>
        <h2 id="order-attempts-heading" className="text-lg font-semibold">
          Ödeme denemeleri
        </h2>
        {detail.attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz ödeme denemesi yok.</p>
        ) : (
          <ol className="space-y-2">
            {detail.attempts.map((attempt, index) => (
              <li key={index} className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="font-medium">{OUTCOME_LABELS[attempt.outcome]}</span>
                <span className="text-muted-foreground">
                  {attempt.provider}
                  {attempt.isDemo ? " (demo)" : ""} · {formatMoney(attempt.amount, detail.currency)} · {formatDate(attempt.at, "datetime")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="order-tickets-heading" className="space-y-3">
        <h2 id="order-tickets-heading" className="text-lg font-semibold">
          Biletler
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {detail.tickets.map((ticket) => {
            const status = TICKET_STATUS[ticket.status];
            const qr = qrImages[ticket.ticketId];
            return (
              <li key={ticket.ticketId} className={cn(cardClass, "flex flex-col items-center text-center")}>
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">Masa {ticket.tableLabel}</p>
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", status.tone)}>{status.label}</span>
                </div>
                <p className="w-full text-left text-sm text-muted-foreground">
                  {SALE_CATEGORY_LABELS[ticket.category]} · {formatMoney(ticket.unitPrice, detail.currency)}
                </p>
                {ticket.status === "issued" && qr ? (
                  // QR bir data URL'dir; yan etkisiz, sabit boyutlu görsel.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt={`Masa ${ticket.tableLabel} bilet QR kodu`} width={168} height={168} className="rounded-md bg-white p-1" />
                ) : null}
                {ticket.checkedInAt ? (
                  <p className="w-full text-left text-sm text-emerald-300">Giriş yapıldı: {formatDate(ticket.checkedInAt, "datetime")}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  );
}
