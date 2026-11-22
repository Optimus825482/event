import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventInvitations, reservations, systemSettings } from "@/db/schema";
import { GET as imageRoute } from "@/app/i/[token]/image/route";
import { getPublicInvitation } from "@/features/invitations/public";
import { parseInvitationToken, signInvitationToken, verifyInvitationMac } from "@/features/invitations/token";
import { UPLOAD_ROOT } from "@/features/uploads/root";
import { eq } from "drizzle-orm";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

sharp.cache(false);

const SECRET = "another-secret-another-secret-0123456789";

async function seedReservation(overrides: Partial<typeof reservations.$inferInsert> = {}) {
  const parents = await f.createBookingParents(db);
  const customer = await f.createCustomer(db, {
    fullName: "Ayşe Yılmaz",
    phone: "0532 111 22 33",
    email: "ayse-gizli@example.com",
    notes: "ÖZEL-NOT-GIZLI",
  });
  const reservation = await f.createReservation(db, {
    eventId: parents.event.id,
    tableId: parents.table.id,
    customerId: customer.id,
    guestPhone: "05329998877",
    guestEmail: "misafir-gizli@example.com",
    specialRequests: "ÖZEL-İSTEK-GIZLI",
    ...overrides,
  });
  return { ...parents, customer, reservation };
}

describe("davetiye belirteci", () => {
  const rid = randomUUID();
  const eid = randomUUID();

  it("imzalar ve doğrular", () => {
    const parsed = parseInvitationToken(signInvitationToken(rid, eid));
    expect(parsed?.reservationId).toBe(rid);
    expect(parsed && verifyInvitationMac(parsed, eid)).toBe(true);
  });

  it("başka etkinlik ya da başka anahtar doğrulanmaz", () => {
    const parsed = parseInvitationToken(signInvitationToken(rid, eid));
    expect(parsed && verifyInvitationMac(parsed, randomUUID())).toBe(false);
    const other = parseInvitationToken(signInvitationToken(rid, eid, SECRET));
    expect(other && verifyInvitationMac(other, eid)).toBe(false);
  });

  it("bozuk biçimler null döner", () => {
    for (const bad of ["", "x", "a.b", "a.b.c", `${Buffer.from("not-a-uuid").toString("base64url")}.AAAA`, ".."]) {
      expect(parseInvitationToken(bad)).toBeNull();
    }
  });
});

describe("herkese açık davetiye", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("geçerli belirteçle yalnızca davetiyenin gösterdiği alanları döner", async () => {
    const { event, reservation, table } = await seedReservation({ guestName: "Ayşe Yılmaz" });
    const result = await getPublicInvitation(db, signInvitationToken(reservation.id, event.id));
    expect(result).not.toBeNull();
    expect(result?.guestName).toBe("Ayşe Yılmaz");
    expect(result?.eventName).toBe(event.name);
    expect(result?.tableLabel).toBe(table.label);
    expect(result?.qrPayload).toBe(reservation.qrToken);
    expect(Object.keys(result ?? {}).sort()).toEqual(
      [
        "backgroundColor", "backgroundGradient", "backgroundImage", "elements", "eventDate", "eventName",
        "eventTime", "guestName", "height", "qrPayload", "tableLabel", "width",
      ].sort(),
    );
  });

  it("yanıtta telefon, e-posta, not ve iç kimlik yoktur", async () => {
    const { event, reservation, customer } = await seedReservation();
    const result = await getPublicInvitation(db, signInvitationToken(reservation.id, event.id));
    const json = JSON.stringify(result);
    for (const secret of [
      "0532", "05329998877", "532 111", "ayse-gizli", "misafir-gizli", "ÖZEL-NOT-GIZLI", "ÖZEL-İSTEK-GIZLI",
      reservation.id, customer.id, event.id, event.organizerId,
    ]) {
      expect(json).not.toContain(secret);
    }
    // Misafir adı rezervasyon anlık görüntüsü yoksa müşteri adından gelir.
    expect(result?.guestName).toBe("Ayşe Yılmaz");
  });

  it("geçersiz belirteç null döner", async () => {
    const { event, reservation } = await seedReservation();
    const good = signInvitationToken(reservation.id, event.id);
    const [idPart] = good.split(".");
    for (const bad of ["", "abc", `${idPart}.${"A".repeat(43)}`, `${good}x`, signInvitationToken(randomUUID(), event.id)]) {
      expect(await getPublicInvitation(db, bad)).toBeNull();
    }
  });

  it("başka etkinliğe ait belirteç null döner", async () => {
    const { reservation } = await seedReservation();
    const other = await f.createEvent(db);
    expect(await getPublicInvitation(db, signInvitationToken(reservation.id, other.id))).toBeNull();
  });

  it("iptal edilmiş rezervasyon ve kapalı davetiye sistemi null döner", async () => {
    const { event, reservation } = await seedReservation();
    const token = signInvitationToken(reservation.id, event.id);
    expect(await getPublicInvitation(db, token)).not.toBeNull();

    await db.insert(systemSettings).values({ invitationSystemEnabled: false });
    expect(await getPublicInvitation(db, token)).toBeNull();
    await db.update(systemSettings).set({ invitationSystemEnabled: true });

    await db.update(reservations).set({ status: "cancelled" }).where(eq(reservations.id, reservation.id));
    expect(await getPublicInvitation(db, token)).toBeNull();
  });

  it("yer tutucuları doldurur ve geçersiz öğeleri atar", async () => {
    const { event, reservation } = await seedReservation({ guestName: "Can Demir" });
    await db.insert(eventInvitations).values({
      eventId: event.id,
      customElements: [
        { id: "a", type: "text", x: 10, y: 10, width: 200, height: 40, content: "Merhaba {{guestName}} - {{tableLabel}} - {{bilinmeyen}}" },
        { id: "b", type: "text", x: 10, y: 60, width: 200, height: 40, backgroundColor: "url(http://evil.example/x)" },
        { id: "c", type: "image", x: 0, y: 0, width: 50, height: 50, imageUrl: "http://evil.example/x.png" },
      ],
    });
    const result = await getPublicInvitation(db, signInvitationToken(reservation.id, event.id));
    expect(result?.elements).toHaveLength(1);
    expect(result?.elements[0]?.content).toMatch(/^Merhaba Can Demir - .+ - $/);
  });
});

describe("herkese açık görsel rotası", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  async function writeImage(kind: string): Promise<string> {
    const rel = `${kind}/${randomUUID()}.webp`;
    const abs = path.join(UPLOAD_ROOT, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, await sharp({ create: { width: 4, height: 4, channels: 3, background: "#f00" } }).webp().toBuffer());
    return rel;
  }

  function call(token: string, p: string | null) {
    const url = `http://localhost:3000/i/${token}/image${p === null ? "" : `?p=${encodeURIComponent(p)}`}`;
    return imageRoute(new Request(url), { params: Promise.resolve({ token }) });
  }

  it("yalnızca o etkinliğin davetiyesinde saklı görseli sunar", async () => {
    const { event, reservation } = await seedReservation();
    const stored = await writeImage("invitation");
    const unrelated = await writeImage("invitation");
    await db.insert(eventInvitations).values({ eventId: event.id, customElements: [], backgroundImage: stored });
    const token = signInvitationToken(reservation.id, event.id);

    try {
      const ok = await call(token, stored);
      expect(ok.status).toBe(200);
      expect(ok.headers.get("content-type")).toBe("image/webp");

      expect((await call(token, unrelated)).status).toBe(404);
      expect((await call(token, "../../etc/passwd")).status).toBe(404);
      expect((await call(token, null)).status).toBe(404);
      expect((await call("bozuk", stored)).status).toBe(404);

      const other = await f.createEvent(db);
      expect((await call(signInvitationToken(reservation.id, other.id), stored)).status).toBe(404);
    } finally {
      await rm(path.join(UPLOAD_ROOT, stored), { force: true });
      await rm(path.join(UPLOAD_ROOT, unrelated), { force: true });
    }
  });
});
