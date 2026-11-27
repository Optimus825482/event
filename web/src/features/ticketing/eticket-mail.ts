import { eq, sql } from "drizzle-orm";
import QRCode from "qrcode";
import type { Db } from "@/db/client";
import { events, orders, systemSettings } from "@/db/schema";
import { seatLabel } from "@/domain/seating";
import { env } from "@/env";
import { createSmtpTransport, type MailMessage, type TransportFactory } from "@/features/invitations/delivery";
import { formatEventWhen } from "@/features/invitations/public";
import { DEMO_NOTICE } from "@/features/sales-api/contract";
import { getSmtpConfig } from "@/features/settings/smtp";
import { DomainError } from "@/lib/action";
import { logError } from "@/lib/log";
import { signOrderToken } from "./order-token";
import { getOrderView } from "./orders-service";
import { formatPnr } from "./pnr";

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

type TableCount = { label: string; count: number; seatNos: number[] };

/**
 * Ödenmiş siparişin e-biletini gönderir: özet, PNR, kişi başı QR eki ve (varsa) sipariş bağlantısı.
 * Başarıda `eticket_sent_at` yazılır; başarısızlıkta değişmez. `createTransport` yalnızca testler içindir.
 */
export async function sendOrderEmail(
  db: Db,
  orderId: string,
  createTransport: TransportFactory = createSmtpTransport,
  options: { siteUrl?: string | undefined } = {},
): Promise<{ sentTo: string }> {
  const [order] = await db
    .select({
      status: orders.status,
      pnr: orders.pnr,
      buyerFirstName: orders.buyerFirstName,
      buyerLastName: orders.buyerLastName,
      buyerEmail: orders.buyerEmail,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      isDemo: orders.isDemo,
      eventName: events.name,
      startsAt: events.startsAt,
    })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .where(eq(orders.id, orderId));
  if (!order) throw new DomainError("not_found", "Sipariş bulunamadı");
  if (order.status !== "paid" || !order.pnr || !order.buyerEmail) {
    throw new DomainError("conflict", "Yalnızca ödenmiş sipariş için e-bilet gönderilir");
  }

  const smtp = await getSmtpConfig(db);
  if (!smtp) {
    throw new DomainError(
      "conflict",
      "E-posta gönderilemiyor: SMTP ayarları yapılandırılmamış. Ayarlar sayfasından sunucu ve gönderen adresini girin.",
    );
  }

  const view = await getOrderView(db, orderId);
  if (!view) throw new DomainError("not_found", "Sipariş bulunamadı");
  const issued = view.tickets;
  const perTable: TableCount[] = [];
  for (const r of issued) {
    let entry = perTable.find((t) => t.label === r.tableLabel);
    if (!entry) {
      entry = { label: r.tableLabel, count: 0, seatNos: [] };
      perTable.push(entry);
    }
    entry.count += 1;
    if (r.seatNo !== null) entry.seatNos.push(r.seatNo);
  }

  const [settings] = await db.select({ name: systemSettings.companyName }).from(systemSettings).limit(1);
  const company = settings?.name ?? "EventFlow";
  const when = formatEventWhen(order.startsAt);
  const pnr = formatPnr(order.pnr);
  const buyerName = `${order.buyerFirstName ?? ""} ${order.buyerLastName ?? ""}`.trim();
  const siteUrl = ("siteUrl" in options ? options.siteUrl : env.SALES_SITE_URL)?.replace(/\/+$/, "");
  const link = siteUrl ? `${siteUrl}/bilet/${signOrderToken(orderId)}` : null;
  const total = `${order.totalAmount} ${order.currency}`;
  const tableLines = perTable.map((t) =>
    t.seatNos.length > 0 ? `${t.label}: ${t.count} kişi · Sandalye ${t.seatNos.join(", ")}` : `${t.label}: ${t.count} kişi`,
  );
  const entryNote = "Girişte her misafir kendi QR kodunu gösterir.";

  const text = [
    ...(order.isDemo ? [DEMO_NOTICE, ""] : []),
    `Sayın ${buyerName},`,
    "",
    `${order.eventName} etkinliği için e-biletleriniz hazır.`,
    `Tarih: ${when.date} ${when.time}`,
    `Sipariş kodu (PNR): ${pnr}`,
    ...tableLines.map((l) => `Masa ${l}`),
    `Toplam: ${total}`,
    "",
    entryNote,
    ...(link ? [`Biletlerinizi görüntülemek için: ${link}`] : []),
    "",
    `Bu e-posta ${company} tarafından otomatik olarak gönderilmiştir.`,
  ].join("\n");

  const qrImages = issued
    .map((t, i) => {
      const title = t.seatNo !== null ? `Bilet ${i + 1} · ${seatLabel(t.tableLabel, t.seatNo)}` : `Bilet ${i + 1}`;
      return `<p style="text-align:center"><img src="cid:ticket-${i + 1}" alt="${esc(title)} QR kodu" width="180" height="180"><br>${esc(title)}</p>`;
    })
    .join("\n");
  const html = `<!DOCTYPE html><html lang="tr"><body style="font-family:Segoe UI,Arial,sans-serif;background:#f4f4f4;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
${order.isDemo ? `<p style="background:#fef3c7;border-radius:8px;padding:8px 12px;font-weight:bold">${esc(DEMO_NOTICE)}</p>\n` : ""}<h1 style="font-size:22px;margin:0 0 12px">E-biletiniz</h1>
<p>Sayın <strong>${esc(buyerName)}</strong>,</p>
<p><strong>${esc(order.eventName)}</strong> etkinliği için e-biletleriniz hazır.</p>
<p>Tarih: <strong>${esc(when.date)} ${esc(when.time)}</strong><br>Sipariş kodu (PNR): <strong>${esc(pnr)}</strong></p>
<ul>${tableLines.map((l) => `<li>Masa ${esc(l)}</li>`).join("")}</ul>
<p>Toplam: <strong>${esc(total)}</strong></p>
<p>${esc(entryNote)}</p>
${qrImages}
${link ? `<p><a href="${esc(link)}">Biletlerinizi görüntüleyin</a></p>\n` : ""}<p style="color:#6b7280;font-size:12px">Bu e-posta ${esc(company)} tarafından otomatik olarak gönderilmiştir.</p>
</div></body></html>`;

  const attachments: MailMessage["attachments"] = [];
  for (const [i, t] of issued.entries()) {
    attachments.push({
      filename: `bilet-${i + 1}.png`,
      content: await QRCode.toBuffer(t.qrPayload, { width: 300, margin: 1 }),
      cid: `ticket-${i + 1}`,
    });
  }

  const to = order.buyerEmail;
  try {
    await createTransport(smtp).sendMail({
      from: smtp.from,
      to,
      subject: `E-biletiniz - ${order.eventName}${order.isDemo ? " (DEMO)" : ""}`.replace(/[\r\n]+/g, " "),
      text,
      html,
      attachments,
    });
  } catch (error) {
    logError("ticketing.sendOrderEmail", error);
    throw new DomainError("conflict", "E-posta gönderilemedi: SMTP sunucusuna ulaşılamadı ya da gönderim reddedildi");
  }
  await db.update(orders).set({ eticketSentAt: sql`now()` }).where(eq(orders.id, orderId));
  return { sentTo: to };
}
