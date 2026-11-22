import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { customers, reservations } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { setBlacklist } from "@/features/customers/service";
import { importReservations, previewReservationImport } from "@/features/import/reservations-import";
import { verifyQrToken } from "@/features/reservations/qr-token";
import { createReservation, lookupReservationByQr } from "@/features/reservations/service";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { actorOf, bookableEvent, expectDomain, xlsx, type Cell } from "./helpers";

const HEADER: Cell[] = ["Masa etiketi", "Misafir adı", "Telefon", "E-posta", "Kişi sayısı", "Not"];
const TAKEN = "Bu masa için aktif bir rezervasyon var";

async function reservationsOf(eventId: string) {
  return db.select().from(reservations).where(eq(reservations.eventId, eventId));
}

describe("rezervasyon içe aktarma", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("spec §13/8: manuel rezervasyonlu masaya satır reddedilir, diğer satırlar oluşur", async () => {
    const { owner, event, tables } = await bookableEvent({ A1: 4, B1: 4 });
    const guest = await f.createCustomer(db);
    await createReservation(db, owner, { eventId: event.id, tableId: tables.A1!.id, guestCount: 2, customerId: guest.id });

    const bytes = await xlsx([HEADER, ["A1", "Ali Veli", "05321112233", null, 2, null], ["B1", "Ayşe Fatma", null, null, 3, "pencere"]]);
    const result = await importReservations(db, owner, { eventId: event.id, bytes });

    expect(result.rows).toEqual([
      { row: 2, status: "skipped", message: TAKEN },
      { row: 3, status: "created", message: "Rezervasyon oluşturuldu" },
    ]);
    expect(result.createdCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(await reservationsOf(event.id)).toHaveLength(2);
  });

  it("spec §13/8: içe aktarılan masaya manuel rezervasyon da reddedilir; QR belirteci doğrulanır", async () => {
    const { owner, event, tables } = await bookableEvent({ A1: 4 });
    const result = await importReservations(db, owner, {
      eventId: event.id,
      bytes: await xlsx([HEADER, ["A1", "Ali Veli", "05321112233", "ali@example.com", 4, "vegan"]]),
    });
    expect(result.rows[0]?.status).toBe("created");

    const [row] = await reservationsOf(event.id);
    if (!row) throw new Error("rezervasyon yok");
    expect(row.status).toBe("confirmed");
    expect(row.guestCount).toBe(4);
    expect(row.specialRequests).toBe("vegan");
    expect(verifyQrToken(row.qrToken)).toEqual({ reservationId: row.id });
    expect(await lookupReservationByQr(db, row.qrToken)).toMatchObject({ reservationId: row.id, tableLabel: "A1" });

    const other = await f.createCustomer(db);
    await expectDomain(
      createReservation(db, owner, { eventId: event.id, tableId: tables.A1!.id, guestCount: 1, customerId: other.id }),
      "conflict",
      TAKEN,
    );
  });

  it("kapasite aşımı satırı reddedilir (manuel girişle aynı mesaj), diğerleri oluşur", async () => {
    const { owner, event } = await bookableEvent({ A1: 4, B1: 6 });
    const result = await importReservations(db, owner, {
      eventId: event.id,
      bytes: await xlsx([HEADER, ["A1", "Ali Veli", null, null, 5, null], ["B1", "Ayşe Fatma", null, null, 6, null]]),
    });
    expect(result.rows.map((r) => [r.row, r.status])).toEqual([[2, "skipped"], [3, "created"]]);
    expect(result.rows[0]?.message).toBe("Kişi sayısı (5) masa kapasitesini (4) aşıyor");
  });

  it("dosyada aynı masa iki kez geçerse ikincisi manuel girişteki çakışma mesajıyla reddedilir", async () => {
    const { owner, event } = await bookableEvent({ A1: 4, B1: 4 });
    const result = await importReservations(db, owner, {
      eventId: event.id,
      bytes: await xlsx([
        HEADER,
        ["A1", "Ali Veli", null, null, 2, null],
        ["B1", "Ayşe Fatma", null, null, 2, null],
        ["A1", "Mehmet Can", null, null, 2, null],
      ]),
    });
    expect(result.rows.map((r) => r.status)).toEqual(["created", "created", "skipped"]);
    expect(result.rows[2]?.message).toBe(TAKEN);
    expect(await reservationsOf(event.id)).toHaveLength(2);
  });

  it("her satır kendi transaction'ındadır: hatalı satır önceki ve sonraki iyi satırları geri almaz", async () => {
    const { owner, event } = await bookableEvent({ A1: 4, B1: 4, C1: 4 });
    const result = await importReservations(db, owner, {
      eventId: event.id,
      bytes: await xlsx([
        HEADER,
        ["A1", "Ali Veli", null, null, 2, null],
        ["YOK", "Hatalı Satır", null, null, 2, null],
        ["B1", "Ayşe Fatma", "telefon-değil", null, 2, null],
        ["C1", "Mehmet Can", null, null, 2, null],
      ]),
    });
    expect(result.rows.map((r) => [r.row, r.status])).toEqual([[2, "created"], [3, "skipped"], [4, "skipped"], [5, "created"]]);
    expect(result.rows[1]?.message).toBe('Masa bu etkinlikte bulunamadı: "YOK"');
    expect(result.rows[2]?.message).toMatch(/telefon/i);
    const saved = await reservationsOf(event.id);
    expect(saved).toHaveLength(2);
    // Hatalı satırın müşteri kaydı da geri alınmış olmalı.
    const names = (await db.select({ n: customers.fullName }).from(customers)).map((c) => c.n).sort();
    expect(names).toEqual(["Ali Veli", "Mehmet Can"]);
  });

  it("aynı telefonun farklı yazımları tek müşteriye bağlanır; müşteri adla eşlenmez", async () => {
    const { owner, event } = await bookableEvent({ A1: 4, A2: 4, A3: 4, A4: 4 });
    await importReservations(db, owner, {
      eventId: event.id,
      bytes: await xlsx([
        HEADER,
        ["A1", "Ali Veli", "0532 111 22 33", null, 2, null],
        ["A2", "Ali V.", "+905321112233", null, 2, null],
        ["A3", "Ali Veli", 5321112233, null, 2, null],
        ["A4", "Ali Veli", "05449998877", null, 2, null],
      ]),
    });
    const all = await db.select().from(customers);
    expect(all).toHaveLength(2);
    const byPhone = all.find((c) => c.phoneNormalized === "+905321112233");
    expect(byPhone).toBeDefined();
    const rows = await reservationsOf(event.id);
    expect(rows.filter((r) => r.customerId === byPhone?.id)).toHaveLength(3);
    expect(byPhone?.totalReservations).toBe(3);
  });

  it("e-posta ile de eşler (büyük/küçük harf fark etmez)", async () => {
    const { owner, event } = await bookableEvent({ A1: 4, A2: 4 });
    await importReservations(db, owner, {
      eventId: event.id,
      bytes: await xlsx([HEADER, ["A1", "Ali", null, "Ali@Example.com", 2, null], ["A2", "Ali Veli", null, "ali@example.com ", 2, null]]),
    });
    expect(await db.select().from(customers)).toHaveLength(1);
  });

  it("kara listedeki müşterinin satırı reddedilir", async () => {
    const { owner, event } = await bookableEvent({ A1: 4 });
    const admin = await actorOf("admin");
    const bad = await f.createCustomer(db, { phone: "05321112233", phoneNormalized: "+905321112233" });
    await setBlacklist(db, admin, { id: bad.id, isBlacklisted: true });
    const result = await importReservations(db, owner, {
      eventId: event.id,
      bytes: await xlsx([HEADER, ["A1", "Ali", "05321112233", null, 2, null]]),
    });
    expect(result.rows[0]).toMatchObject({ status: "skipped" });
    expect(result.rows[0]?.message).toMatch(/kara liste/);
    expect(await reservationsOf(event.id)).toHaveLength(0);
  });

  it("önizleme hiçbir şey yazmaz ve satır durumlarını raporlar; onay önizlemeye güvenmez", async () => {
    const { owner, event, tables } = await bookableEvent({ A1: 4, B1: 4 });
    const bytes = await xlsx([
      HEADER,
      ["A1", "Ali Veli", null, null, 2, null],
      ["B1", "Ayşe", null, null, 9, null],
      ["Z9", "Mehmet", null, null, 2, null],
    ]);
    const preview = await previewReservationImport(db, owner, { eventId: event.id, bytes });
    expect(preview.rows.map((r) => [r.row, r.status])).toEqual([[2, "ok"], [3, "error"], [4, "error"]]);
    expect(preview.okCount).toBe(1);
    expect(preview.errorCount).toBe(2);
    expect(await reservationsOf(event.id)).toHaveLength(0);
    expect(await db.select().from(customers)).toHaveLength(0);

    // Önizleme ile onay arasında masa manuel alınır: onay yeniden ayrıştırır ve çakışmayı yakalar.
    const guest = await f.createCustomer(db);
    await createReservation(db, owner, { eventId: event.id, tableId: tables.A1!.id, guestCount: 1, customerId: guest.id });
    const result = await importReservations(db, owner, { eventId: event.id, bytes });
    expect(result.rows[0]).toEqual({ row: 2, status: "skipped", message: TAKEN });
  });

  it("önizleme, dolu masayı ve dosya içi tekrarı hata olarak işaretler", async () => {
    const { owner, event, tables } = await bookableEvent({ A1: 4, B1: 4 });
    const guest = await f.createCustomer(db);
    await createReservation(db, owner, { eventId: event.id, tableId: tables.A1!.id, guestCount: 1, customerId: guest.id });
    const preview = await previewReservationImport(db, owner, {
      eventId: event.id,
      bytes: await xlsx([HEADER, ["A1", "Ali", null, null, 2, null], ["B1", "Ayşe", null, null, 2, null], ["b1", "Veli", null, null, 2, null]]),
    });
    expect(preview.rows.map((r) => r.status)).toEqual(["error", "ok", "error"]);
    expect(preview.rows[0]?.message).toBe(TAKEN);
    expect(preview.rows[2]?.message).toBe(TAKEN);
  });

  it("başlık takma adlarıyla ve sütun sırası farklı dosyayla çalışır", async () => {
    const { owner, event } = await bookableEvent({ A1: 4 });
    const result = await importReservations(db, owner, {
      eventId: event.id,
      bytes: await xlsx([["PAX", "GSM", "ad soyad", "TABLE"], [3, "0532 111 22 33", "Ali Veli", "a1"]]),
    });
    expect(result.rows[0]?.status).toBe("created");
  });

  it("zorunlu başlık eksikse hiçbir şey yazılmaz ve beklenen başlıklar sayılır", async () => {
    const { owner, event } = await bookableEvent({ A1: 4 });
    await expectDomain(
      importReservations(db, owner, { eventId: event.id, bytes: await xlsx([["Masa", "Ad"], ["A1", "Ali"]]) }),
      "invalid",
      /Kişi sayısı/,
    );
    expect(await reservationsOf(event.id)).toHaveLength(0);
  });

  it("yetki ve sahiplik: controller yasak (staff reservations.create ile yapabilir), başka organizatörün etkinliği not_found, taslak etkinlik conflict", async () => {
    const { owner, event } = await bookableEvent({ A1: 4 });
    const bytes = await xlsx([HEADER, ["A1", "Ali", null, null, 2, null]]);
    await expect(importReservations(db, await actorOf("venue_owner"), { eventId: event.id, bytes })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(importReservations(db, await actorOf("controller"), { eventId: event.id, bytes })).rejects.toBeInstanceOf(ForbiddenError);
    await expectDomain(importReservations(db, await actorOf("organizer"), { eventId: event.id, bytes }), "not_found");
    await expectDomain(previewReservationImport(db, await actorOf("organizer"), { eventId: event.id, bytes }), "not_found");
    const staffer = await actorOf("staff");
    expect((await importReservations(db, staffer, { eventId: event.id, bytes })).createdCount).toBe(1);
    const admin = await actorOf("admin");
    expect((await previewReservationImport(db, admin, { eventId: event.id, bytes })).errorCount).toBe(1);

    const draft = await f.createEvent(db, { organizerId: owner.id, status: "draft" });
    await f.createTable(db, draft.id, { label: "A1", capacity: 4 });
    await expectDomain(importReservations(db, owner, { eventId: draft.id, bytes }), "conflict", /rezervasyona açık değil/);
    expect(await db.select().from(reservations).where(and(eq(reservations.eventId, draft.id)))).toHaveLength(0);
  });

  it("10 MB üstü ve .xlsx olmayan dosya servis düzeyinde reddedilir", async () => {
    const { owner, event } = await bookableEvent({ A1: 4 });
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set([0x50, 0x4b, 0x03, 0x04]);
    await expectDomain(importReservations(db, owner, { eventId: event.id, bytes: big }), "invalid", /10 MB/);
    await expectDomain(
      importReservations(db, owner, { eventId: event.id, bytes: new TextEncoder().encode("Masa,Ad\nA1,Ali") }),
      "invalid",
      "Yalnızca .xlsx dosyaları kabul edilir",
    );
  });
});
