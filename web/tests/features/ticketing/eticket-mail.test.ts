import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { eventTables, events, orders, systemSettings, tickets } from "@/db/schema";
import type { MailMessage, TransportFactory } from "@/features/invitations/delivery";
import { DEMO_NOTICE } from "@/features/sales-api/contract";
import { sendOrderEmail } from "@/features/ticketing/eticket-mail";
import { signOrderToken } from "@/features/ticketing/order-token";
import { payOrder } from "@/features/ticketing/orders-service";
import type { PaymentProvider } from "@/features/ticketing/payment/provider";
import { formatPnr } from "@/features/ticketing/pnr";
import { truncateAll } from "../../helpers/db";
import { createPaidOrder, createPendingHold } from "../../helpers/ticketing";
import { saleEvent } from "./fixtures";

const previousKey = process.env.SETTINGS_ENCRYPTION_KEY;
beforeAll(() => {
  process.env.SETTINGS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});
afterAll(() => {
  if (previousKey === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
  else process.env.SETTINGS_ENCRYPTION_KEY = previousKey;
});

async function configureSmtp() {
  await db.insert(systemSettings).values({ smtpHost: "smtp.example.test", smtpPort: 465, smtpFromEmail: "bilet@example.test" });
}

function capture() {
  const sent: MailMessage[] = [];
  const factory: TransportFactory = () => ({
    sendMail: async (m) => {
      sent.push(m);
    },
  });
  return { sent, factory };
}

async function sentAt(orderId: string) {
  const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
  return row?.eticketSentAt;
}

async function oneTicketOrder() {
  const {
    event,
    tables: [a1],
  } = await saleEvent();
  const paid = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 1 }] });
  return { event, a1: a1!, paid };
}

describe("e-bilet e-postası", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("ödenmiş sipariş için tek e-posta: özet, PNR, kişi başı QR, bağlantı, demo ibaresi", async () => {
    await configureSmtp();
    const {
      event,
      tables: [a1, b1],
    } = await saleEvent({ tables: [{ label: "A1" }, { label: "B1" }] });
    const paid = await createPaidOrder(db, {
      eventId: event.id,
      items: [
        { tableId: a1!.id, quantity: 2 },
        { tableId: b1!.id, quantity: 1 },
      ],
    });
    const { sent, factory } = capture();
    const res = await sendOrderEmail(db, paid.orderId, factory, { siteUrl: "https://bilet.example.test" });
    expect(res).toEqual({ sentTo: "ayse@example.com" });
    expect(sent).toHaveLength(1);
    const mail = sent[0]!;
    expect(mail.to).toBe("ayse@example.com");
    expect(mail.subject).toBe(`E-biletiniz - ${event.name} (DEMO)`);
    expect(mail.attachments.map((a) => a.cid)).toEqual(["ticket-1", "ticket-2", "ticket-3"]);
    expect(mail.attachments.map((a) => a.filename)).toEqual(["bilet-1.png", "bilet-2.png", "bilet-3.png"]);
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain(formatPnr(paid.pnr!));
      expect(body).toContain("DEMO - gerçek ödeme alınmadı");
      expect(body).toContain("A1");
      expect(body).toContain("B1");
      expect(body).toContain(`https://bilet.example.test/bilet/${signOrderToken(paid.orderId)}`);
    }
    expect(mail.text).toContain("A1: 2 kişi");
    expect(mail.text).toContain("B1: 1 kişi");
    expect(mail.text).toContain("Girişte her misafir kendi QR kodunu gösterir.");
    expect(mail.html.match(/cid:ticket-\d/g)).toHaveLength(3);
    expect(await sentAt(paid.orderId)).toBeInstanceOf(Date);
  });

  it("ek QR'lar biletlerin belirteçlerini kodlar", async () => {
    await configureSmtp();
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const paid = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 3 }] });
    const { sent, factory } = capture();
    await sendOrderEmail(db, paid.orderId, factory, { siteUrl: undefined });
    const rows = await db.select({ qr: tickets.qrToken }).from(tickets).where(eq(tickets.orderId, paid.orderId));
    const expected = await Promise.all(rows.map((r) => QRCode.toBuffer(r.qr!, { width: 300, margin: 1 })));
    const contents = sent[0]!.attachments.map((a) => a.content);
    expect(contents.every((c) => c.length > 0)).toBe(true);
    expect(new Set(contents.map((c) => c.toString("base64"))).size).toBe(3);
    for (const e of expected) expect(contents.some((c) => c.equals(e))).toBe(true);
  });

  it("gerçek (demo olmayan) siparişte DEMO ibaresi ve konu eki yoktur", async () => {
    await configureSmtp();
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const provider: PaymentProvider = {
      id: "demo",
      isDemo: false,
      start: async () => ({ outcome: "approved", providerRef: `x-${randomUUID()}` }),
    };
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 1 }] });
    const paid = await payOrder(
      db,
      hold.orderId,
      { buyer: { firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@example.com" }, acceptTerms: true, payment: { provider: "demo", action: "approve" } },
      { provider },
    );
    const { sent, factory } = capture();
    await sendOrderEmail(db, paid.orderId, factory, { siteUrl: undefined });
    const mail = sent[0]!;
    expect(mail.subject).not.toContain("(DEMO)");
    expect(mail.text).not.toContain(DEMO_NOTICE);
    expect(mail.html).not.toContain(DEMO_NOTICE);
  });

  it("satış sitesi adresi yoksa bağlantı eklenmez", async () => {
    await configureSmtp();
    const { paid } = await oneTicketOrder();
    const { sent, factory } = capture();
    await sendOrderEmail(db, paid.orderId, factory, { siteUrl: undefined });
    expect(sent[0]!.html).not.toContain("/bilet/");
    expect(sent[0]!.text).not.toContain("/bilet/");
  });

  it("etkinlik adı ve alıcı adı HTML'de kaçırılır", async () => {
    await configureSmtp();
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    await db.update(events).set({ name: '<b>Gala</b> & "Yıl"' }).where(eq(events.id, event.id));
    const paid = await createPaidOrder(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 1 }],
      buyer: { firstName: "Ayşe", lastName: "<script>", email: "ayse@example.com" },
    });
    const { sent, factory } = capture();
    await sendOrderEmail(db, paid.orderId, factory, { siteUrl: undefined });
    const html = sent[0]!.html;
    expect(html).not.toContain("<b>Gala</b>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b&gt;Gala&lt;/b&gt; &amp;");
  });

  it("tarih Kıbrıs saatiyle yazılır", async () => {
    await configureSmtp();
    const { event, paid } = await oneTicketOrder();
    await db.update(events).set({ startsAt: new Date("2027-01-10T18:00:00Z") }).where(eq(events.id, event.id));
    const { sent, factory } = capture();
    await sendOrderEmail(db, paid.orderId, factory, { siteUrl: undefined });
    expect(sent[0]!.text).toContain("10 Ocak 2027");
    expect(sent[0]!.text).toContain("20:00");
  });

  it("ödenmemiş sipariş için gönderilmez", async () => {
    await configureSmtp();
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 1 }] });
    const factory = vi.fn<TransportFactory>();
    await expect(sendOrderEmail(db, hold.orderId, factory)).rejects.toMatchObject({
      code: "conflict",
      message: "Yalnızca ödenmiş sipariş için e-bilet gönderilir",
    });
    expect(factory).not.toHaveBeenCalled();
  });

  it("SMTP yapılandırılmamışsa anlaşılır hata; taşıyıcı oluşturulmaz, gönderim zamanı yazılmaz", async () => {
    const { paid } = await oneTicketOrder();
    const factory = vi.fn<TransportFactory>();
    await expect(sendOrderEmail(db, paid.orderId, factory)).rejects.toMatchObject({
      code: "conflict",
      message: "E-posta gönderilemiyor: SMTP ayarları yapılandırılmamış. Ayarlar sayfasından sunucu ve gönderen adresini girin.",
    });
    expect(factory).not.toHaveBeenCalled();
    expect(await sentAt(paid.orderId)).toBeNull();
  });

  it("taşıyıcı hata verirse ayrıntı sızdırmadan conflict; gönderim zamanı yazılmaz", async () => {
    await configureSmtp();
    const { paid } = await oneTicketOrder();
    const factory: TransportFactory = () => ({ sendMail: () => Promise.reject(new Error("535 auth failed")) });
    const error = await sendOrderEmail(db, paid.orderId, factory).catch((e: unknown) => e);
    expect(error).toMatchObject({
      code: "conflict",
      message: "E-posta gönderilemedi: SMTP sunucusuna ulaşılamadı ya da gönderim reddedildi",
    });
    expect((error as Error).message).not.toContain("535");
    expect(await sentAt(paid.orderId)).toBeNull();
  });

  it("olmayan sipariş not_found", async () => {
    await expect(sendOrderEmail(db, randomUUID(), vi.fn<TransportFactory>())).rejects.toMatchObject({
      code: "not_found",
      message: "Sipariş bulunamadı",
    });
  });

  it("sandalye bazlı siparişte e-posta sandalye numaralarını taşır", async () => {
    await configureSmtp();
    const {
      event,
      tables: [a1, b1],
    } = await saleEvent({ tables: [{ label: "A1" }, { label: "B1" }] });
    const paid = await createPaidOrder(db, {
      eventId: event.id,
      items: [
        { tableId: a1!.id, quantity: 2, seatNos: [6, 5] },
        { tableId: b1!.id, quantity: 1, seatNos: [2] },
      ],
    });
    const { sent, factory } = capture();
    await sendOrderEmail(db, paid.orderId, factory, { siteUrl: undefined });
    const mail = sent[0]!;
    expect(mail.text).toContain("Masa A1: 2 kişi · Sandalye 5, 6");
    expect(mail.text).toContain("Masa B1: 1 kişi · Sandalye 2");
    expect(mail.html).toContain("Bilet 1 · Masa A1 · Sandalye 5");
    expect(mail.html).toContain("Bilet 2 · Masa A1 · Sandalye 6");
    expect(mail.html).toContain("Bilet 3 · Masa B1 · Sandalye 2");
    expect(mail.attachments.map((a) => a.cid)).toEqual(["ticket-1", "ticket-2", "ticket-3"]);
  });

  it.each([
    ["masa bazlı kip", { settings: { saleMode: "table" } }, 8],
    ["loca", { tables: [{ isLoca: true, capacity: 6 }], settings: { locaOnline: true } }, 6],
  ] as const)("%s: e-postada sandalye yazmaz", async (_n, o, seats) => {
    await configureSmtp();
    const {
      event,
      tables: [a1],
    } = await saleEvent({ ...o } as Parameters<typeof saleEvent>[0]);
    const paid = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: seats }] });
    const { sent, factory } = capture();
    await sendOrderEmail(db, paid.orderId, factory, { siteUrl: undefined });
    const mail = sent[0]!;
    expect(mail.text).not.toContain("Sandalye");
    expect(mail.html).not.toContain("Sandalye");
    expect(mail.text).toContain(`Masa A1: ${seats} kişi`);
  });

  it("etiketteki HTML karakterleri sandalye satırında da kaçışlanır", async () => {
    await configureSmtp();
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    await db.update(eventTables).set({ label: "A<1>" }).where(eq(eventTables.id, a1!.id));
    const paid = await createPaidOrder(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 1, seatNos: [1] }],
    });
    const { sent, factory } = capture();
    await sendOrderEmail(db, paid.orderId, factory, { siteUrl: undefined });
    expect(sent[0]!.html).toContain("Masa A&lt;1&gt; · Sandalye 1");
  });
});
