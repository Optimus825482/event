import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { customers, systemSettings } from "@/db/schema";
import type { Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/session";
import { buildWhatsAppUrl, sendInvitationEmail, getWhatsAppLink, type MailMessage, type TransportFactory } from "@/features/invitations/delivery";
import { listRecipients } from "@/features/invitations/event-invitation";
import { parseInvitationToken, verifyInvitationMac } from "@/features/invitations/token";
import { encryptSecret } from "@/features/settings/crypto";
import { getSmtpConfig } from "@/features/settings/smtp";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

const KEY = randomBytes(32);
const previousKey = process.env.SETTINGS_ENCRYPTION_KEY;

beforeAll(() => {
  process.env.SETTINGS_ENCRYPTION_KEY = KEY.toString("base64");
});
afterAll(() => {
  if (previousKey === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
  else process.env.SETTINGS_ENCRYPTION_KEY = previousKey;
});

async function makeActor(role: Role): Promise<Actor> {
  const u = await f.createUser(db, { role });
  return { id: u.id, username: u.username, role: u.role, staffId: u.staffId, memberships: [], permissions: [] };
}

async function seed(organizerId?: string, contact: { email?: string; phone?: string } = { email: "misafir@example.com", phone: "0532 111 22 33" }) {
  const event = await f.createEvent(db, organizerId ? { organizerId } : {});
  const table = await f.createTable(db, event.id, { label: "A1" });
  const customer = await f.createCustomer(db, { fullName: "Ayşe Yılmaz", email: contact.email ?? null, phone: contact.phone ?? null });
  const reservation = await f.createReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
  return { event, reservation, customer };
}

async function configureSmtp() {
  await db.insert(systemSettings).values({
    smtpHost: "smtp.example.test",
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: "robot",
    smtpPasswordEncrypted: encryptSecret("çok-gizli-parola", KEY),
    smtpFromEmail: "davet@example.test",
    smtpFromName: "EventFlow",
  });
}

function recorder() {
  const sent: MailMessage[] = [];
  let created = 0;
  const factory: TransportFactory = () => {
    created += 1;
    return {
      sendMail: async (message) => {
        sent.push(message);
        return {};
      },
    };
  };
  return { sent, factory, created: () => created };
}

describe("SMTP yapılandırması", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("ayar yoksa ya da sunucu boşsa null döner", async () => {
    expect(await getSmtpConfig(db, KEY)).toBeNull();
    await db.insert(systemSettings).values({});
    expect(await getSmtpConfig(db, KEY)).toBeNull();
  });

  it("parolayı çözer ve gönderen adresini biçimler", async () => {
    await configureSmtp();
    expect(await getSmtpConfig(db, KEY)).toEqual({
      host: "smtp.example.test",
      port: 465,
      secure: true,
      user: "robot",
      password: "çok-gizli-parola",
      from: '"EventFlow" <davet@example.test>',
    });
  });

  it("yanlış anahtarla anlaşılır hata verir ve parolayı sızdırmaz", async () => {
    await configureSmtp();
    const error = await getSmtpConfig(db, randomBytes(32)).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "conflict" });
    expect(String((error as Error).message)).not.toContain("çok-gizli-parola");
  });
});

describe("e-posta gönderimi", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("SMTP yapılandırılmamışsa anlaşılır hata verir ve taşıyıcı oluşturmaz", async () => {
    const admin = await makeActor("admin");
    const { reservation } = await seed();
    const mail = recorder();
    await expect(sendInvitationEmail(db, admin, { reservationId: reservation.id }, mail.factory)).rejects.toMatchObject({
      code: "conflict",
      message: expect.stringContaining("SMTP ayarları yapılandırılmamış"),
    });
    expect(mail.created()).toBe(0);
  });

  it("e-postayı gönderir: alıcı, bağlantı, QR eki; HTML kaçırılır", async () => {
    await configureSmtp();
    const admin = await makeActor("admin");
    const { reservation, event, customer } = await seed();
    await db.update(customers).set({ fullName: "<b>Ayşe</b>" });
    const mail = recorder();
    const res = await sendInvitationEmail(db, admin, { reservationId: reservation.id }, mail.factory);
    expect(res.sentTo).toBe("misafir@example.com");
    const message = mail.sent[0];
    expect(message).toBeDefined();
    expect(message?.to).toBe("misafir@example.com");
    expect(message?.from).toBe('"EventFlow" <davet@example.test>');
    expect(message?.subject).toContain(event.name);
    expect(message?.html).not.toContain("<b>Ayşe</b>");
    expect(message?.html).toContain("&lt;b&gt;");
    expect(message?.attachments[0]?.cid).toBe("qrcode");
    expect(message?.html).not.toContain(customer.id);
    const link = /http:\/\/localhost:3000\/i\/([^\s"<]+)/.exec(message?.text ?? "")?.[1];
    const parsed = link ? parseInvitationToken(link) : null;
    expect(parsed?.reservationId).toBe(reservation.id);
    expect(parsed && verifyInvitationMac(parsed, event.id)).toBe(true);
  });

  it("e-posta adresi yoksa reddeder; taşıyıcı hata verirse ayrıntı sızdırmadan conflict", async () => {
    await configureSmtp();
    const admin = await makeActor("admin");
    const noMail = await seed(undefined, { phone: "0532 111 22 33" });
    const mail = recorder();
    await expect(sendInvitationEmail(db, admin, { reservationId: noMail.reservation.id }, mail.factory)).rejects.toMatchObject({
      code: "conflict",
      message: expect.stringContaining("e-posta"),
    });
    const ok = await seed();
    const failing: TransportFactory = () => ({
      sendMail: async () => {
        throw new Error("connect ECONNREFUSED 10.0.0.5:465 user=robot");
      },
    });
    const error = await sendInvitationEmail(db, admin, { reservationId: ok.reservation.id }, failing).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "conflict" });
    expect(String((error as Error).message)).not.toContain("10.0.0.5");
  });

  it("organizatör başkasının etkinliği için gönderemez; staff rolü yetkisizdir", async () => {
    await configureSmtp();
    const owner = await makeActor("organizer");
    const other = await makeActor("organizer");
    const { reservation } = await seed(owner.id);
    const mail = recorder();
    await expect(sendInvitationEmail(db, other, { reservationId: reservation.id }, mail.factory)).rejects.toMatchObject({ code: "not_found" });
    await expect(sendInvitationEmail(db, await makeActor("staff"), { reservationId: reservation.id }, mail.factory)).rejects.toThrow();
    expect(mail.sent).toHaveLength(0);
    await expect(sendInvitationEmail(db, owner, { reservationId: reservation.id }, mail.factory)).resolves.toBeDefined();
  });
});

describe("WhatsApp bağlantısı", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("biçim: wa.me/<rakamlar>?text=", () => {
    expect(buildWhatsAppUrl("0532 111 22 33", "Merhaba dünya")).toBe(
      `https://wa.me/905321112233?text=${encodeURIComponent("Merhaba dünya")}`,
    );
    expect(buildWhatsAppUrl(null, "x")).toBe("https://wa.me/?text=x");
    expect(buildWhatsAppUrl("+44 20 7946 0958", "x")).toBe("https://wa.me/442079460958?text=x");
  });

  it("mesaj imzalı davetiye bağlantısını içerir", async () => {
    const admin = await makeActor("admin");
    const { reservation, event } = await seed();
    const res = await getWhatsAppLink(db, admin, { reservationId: reservation.id });
    expect(res.hasPhone).toBe(true);
    expect(res.url.startsWith("https://wa.me/905321112233?text=")).toBe(true);
    const text = decodeURIComponent(res.url.split("?text=")[1] ?? "");
    expect(text).toContain(event.name);
    expect(text).toMatch(/http:\/\/localhost:3000\/i\/\S+/);
  });

  it("telefon yoksa numarasız bağlantı", async () => {
    const admin = await makeActor("admin");
    const { reservation } = await seed(undefined, { email: "a@example.com" });
    const res = await getWhatsAppLink(db, admin, { reservationId: reservation.id });
    expect(res.hasPhone).toBe(false);
    expect(res.url.startsWith("https://wa.me/?text=")).toBe(true);
  });
});

describe("alıcı listesi", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("iletişim bilgisini değil yalnızca var olup olmadığını döner", async () => {
    const admin = await makeActor("admin");
    const { event } = await seed();
    const rows = await listRecipients(db, admin, { eventId: event.id });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ guestName: "Ayşe Yılmaz", tableLabel: "A1", hasEmail: true, hasPhone: true });
    const json = JSON.stringify(rows);
    expect(json).not.toContain("misafir@example.com");
    expect(json).not.toContain("0532");
  });

  it("organizatör başkasının etkinliğinin alıcılarını göremez", async () => {
    const owner = await makeActor("organizer");
    const other = await makeActor("organizer");
    const { event } = await seed(owner.id);
    await expect(listRecipients(db, other, { eventId: event.id })).rejects.toMatchObject({ code: "not_found" });
  });
});
