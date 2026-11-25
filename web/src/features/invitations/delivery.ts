import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import type { Db } from "@/db/client";
import { customers, eventTables, events, reservations, systemSettings } from "@/db/schema";
import { env } from "@/env";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { normalizeEmail, normalizePhone } from "@/features/customers/normalize";
import { getSmtpConfig, type SmtpConfig } from "@/features/settings/smtp";
import { DomainError } from "@/lib/action";
import { logError } from "@/lib/log";
import { assertInvitationSystemEnabled } from "./access";
import { formatEventWhen } from "./public";
import type { ReservationIdInput } from "./schemas";
import { signInvitationToken } from "./token";

export type MailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments: { filename: string; content: Buffer; cid: string }[];
};
export type MailTransport = { sendMail(message: MailMessage): Promise<unknown> };
export type TransportFactory = (config: SmtpConfig) => MailTransport;

/** Gerçek taşıyıcı; testler kendi `TransportFactory`'lerini enjekte eder. */
export const createSmtpTransport: TransportFactory = (config) =>
  nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    connectionTimeout: 10_000,
    socketTimeout: 20_000,
    ...(config.user ? { auth: { user: config.user, pass: config.password } } : {}),
  });

type Target = {
  reservationId: string;
  eventId: string;
  organizerId: string;
  eventName: string;
  startsAt: Date;
  tableLabel: string;
  guestCount: number;
  guestName: string;
  email: string | null;
  phone: string | null;
  status: string;
  qrToken: string;
};

async function loadTarget(db: Db, actor: Actor, reservationId: string): Promise<Target> {
  const [row] = await db
    .select({
      reservationId: reservations.id,
      eventId: reservations.eventId,
      organizerId: events.organizerId,
      eventName: events.name,
      startsAt: events.startsAt,
      tableLabel: eventTables.label,
      guestCount: reservations.guestCount,
      guestName: reservations.guestName,
      customerName: customers.fullName,
      guestEmail: reservations.guestEmail,
      customerEmail: customers.email,
      guestPhone: reservations.guestPhone,
      customerPhone: customers.phone,
      status: reservations.status,
      qrToken: reservations.qrToken,
    })
    .from(reservations)
    .innerJoin(events, eq(events.id, reservations.eventId))
    .innerJoin(customers, eq(customers.id, reservations.customerId))
    .innerJoin(eventTables, eq(eventTables.id, reservations.tableId))
    .where(eq(reservations.id, reservationId));
  if (!row) {
    throw new DomainError("not_found", "Rezervasyon bulunamadı");
  }
  if (row.status === "cancelled" || row.status === "no_show") {
    throw new DomainError("conflict", "İptal edilmiş rezervasyon için davetiye gönderilemez");
  }
  return {
    reservationId: row.reservationId,
    eventId: row.eventId,
    organizerId: row.organizerId,
    eventName: row.eventName,
    startsAt: row.startsAt,
    tableLabel: row.tableLabel,
    guestCount: row.guestCount,
    guestName: row.guestName?.trim() || row.customerName,
    email: row.guestEmail?.trim() || row.customerEmail?.trim() || null,
    phone: row.guestPhone?.trim() || row.customerPhone?.trim() || null,
    status: row.status,
    qrToken: row.qrToken,
  };
}

/** Misafirin herkese açık davetiye bağlantısı (imzalı belirteç). */
export function buildInvitationUrl(reservationId: string, eventId: string): string {
  const base = env.BETTER_AUTH_URL.replace(/\/+$/, "");
  return `${base}/i/${signInvitationToken(reservationId, eventId)}`;
}

/** `https://wa.me/<rakamlar>?text=…`; telefon yoksa numarasız (kişi seçilen) bağlantı. */
export function buildWhatsAppUrl(rawPhone: string | null, message: string): string {
  const normalized = rawPhone ? normalizePhone(rawPhone) : null;
  const digits = normalized ? normalized.slice(1) : (rawPhone ?? "").replace(/\D/g, "");
  const text = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

export async function getWhatsAppLink(db: Db, actor: Actor, input: ReservationIdInput): Promise<{ url: string; hasPhone: boolean }> {
  authorize(actor, "invitations", "view");
  await assertInvitationSystemEnabled(db);
  const target = await loadTarget(db, actor, input.reservationId);
  const when = formatEventWhen(target.startsAt);
  const link = buildInvitationUrl(target.reservationId, target.eventId);
  const message = [
    `Sayın ${target.guestName},`,
    "",
    `${target.eventName} etkinliği için davetiyeniz hazır.`,
    `Tarih: ${when.date} ${when.time}`,
    `Masa: ${target.tableLabel}`,
    `Kişi: ${target.guestCount}`,
    "",
    `Davetiyeniz ve giriş QR kodunuz: ${link}`,
  ].join("\n");
  return { url: buildWhatsAppUrl(target.phone, message), hasPhone: Boolean(target.phone) };
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

function emailBodies(target: Target, when: { date: string; time: string }, link: string, company: string) {
  const text = [
    `Sayın ${target.guestName},`,
    "",
    `${target.eventName} etkinliği için rezervasyon biletiniz hazır.`,
    `Tarih: ${when.date} ${when.time}`,
    `Masa: ${target.tableLabel}`,
    "",
    `Davetiyenizi görüntülemek için: ${link}`,
    "Giriş için ekteki QR kodu görevlilere gösterin.",
    "",
    `Bu e-posta ${company} tarafından otomatik olarak gönderilmiştir.`,
  ].join("\n");
  const html = `<!DOCTYPE html><html lang="tr"><body style="font-family:Segoe UI,Arial,sans-serif;background:#f4f4f4;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
<h1 style="font-size:22px;margin:0 0 12px">Rezervasyon Biletiniz</h1>
<p>Sayın <strong>${esc(target.guestName)}</strong>,</p>
<p><strong>${esc(target.eventName)}</strong> etkinliği için rezervasyon biletiniz hazır.</p>
<p>Tarih: <strong>${esc(when.date)} ${esc(when.time)}</strong><br>Masa: <strong>${esc(target.tableLabel)}</strong></p>
<p style="text-align:center"><img src="cid:qrcode" alt="Giriş QR kodu" width="180" height="180"></p>
<p><a href="${esc(link)}">Davetiyenizi görüntüleyin</a></p>
<p style="color:#6b7280;font-size:12px">Bu e-posta ${esc(company)} tarafından otomatik olarak gönderilmiştir.</p>
</div></body></html>`;
  return { text, html };
}

/**
 * Davetiyeyi e-postayla gönderir. SMTP yapılandırılmamışsa `conflict` (anlaşılır Türkçe mesaj).
 * `createTransport` yalnızca testler içindir.
 */
export async function sendInvitationEmail(
  db: Db,
  actor: Actor,
  input: ReservationIdInput,
  createTransport: TransportFactory = createSmtpTransport,
): Promise<{ sentTo: string }> {
  authorize(actor, "invitations", "edit");
  await assertInvitationSystemEnabled(db);
  const target = await loadTarget(db, actor, input.reservationId);

  const smtp = await getSmtpConfig(db);
  if (!smtp) {
    throw new DomainError(
      "conflict",
      "E-posta gönderilemiyor: SMTP ayarları yapılandırılmamış. Ayarlar sayfasından sunucu ve gönderen adresini girin.",
    );
  }
  const to = target.email ? normalizeEmail(target.email) : null;
  if (!to) throw new DomainError("conflict", "Misafirin geçerli bir e-posta adresi yok");

  const [company] = await db.select({ name: systemSettings.companyName }).from(systemSettings).limit(1);
  const when = formatEventWhen(target.startsAt);
  const link = buildInvitationUrl(target.reservationId, target.eventId);
  const { text, html } = emailBodies(target, when, link, company?.name ?? "EventFlow");
  const qr = await QRCode.toBuffer(target.qrToken, { width: 300, margin: 1 });

  try {
    await createTransport(smtp).sendMail({
      from: smtp.from,
      to,
      subject: `Rezervasyon Biletiniz - ${target.eventName}`.replace(/[\r\n]+/g, " "),
      text,
      html,
      attachments: [{ filename: "davetiye-qr.png", content: qr, cid: "qrcode" }],
    });
  } catch (error) {
    logError("invitations.sendEmail", error);
    throw new DomainError("conflict", "E-posta gönderilemedi: SMTP sunucusuna ulaşılamadı ya da gönderim reddedildi");
  }
  return { sentTo: to };
}
