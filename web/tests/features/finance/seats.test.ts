import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { casinoCapacity, sellableSeatsByCategory } from "@/features/finance/seats";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

describe("sandalye sayımı", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("yalnızca online ve pending masalar sayılır; null satılabilir = kapasite", async () => {
    const event = await f.createEvent(db);
    await f.createTable(db, event.id, { saleCategory: "standard", allocation: "online", capacity: 10, sellableSeats: null });
    await f.createTable(db, event.id, { saleCategory: "standard", allocation: "pending", capacity: 8, sellableSeats: 6 });
    await f.createTable(db, event.id, { saleCategory: "standard", allocation: "casino", capacity: 12 });
    await f.createTable(db, event.id, { saleCategory: "standard", allocation: "closed", capacity: 12 });
    await f.createTable(db, event.id, { saleCategory: "premium", allocation: "online", capacity: 4, sellableSeats: 3 });
    expect(await sellableSeatsByCategory(db, event.id, { includeLoca: true })).toEqual({
      standard: 16,
      premium: 3,
      vip: 0,
    });
  });

  it("includeLoca kapalıyken loca sayılmaz, açıkken sayılır", async () => {
    const event = await f.createEvent(db);
    await f.createTable(db, event.id, { saleCategory: "vip", allocation: "online", capacity: 6, isLoca: true });
    expect(await sellableSeatsByCategory(db, event.id, { includeLoca: false })).toEqual({
      standard: 0,
      premium: 0,
      vip: 0,
    });
    expect((await sellableSeatsByCategory(db, event.id, { includeLoca: true })).vip).toBe(6);
  });

  it("casinoCapacity satılabilir sayıyı değil kapasiteyi toplar", async () => {
    const event = await f.createEvent(db);
    await f.createTable(db, event.id, { allocation: "casino", capacity: 10, sellableSeats: 4 });
    await f.createTable(db, event.id, { allocation: "casino", capacity: 8 });
    await f.createTable(db, event.id, { allocation: "online", capacity: 6 });
    expect(await casinoCapacity(db, event.id)).toBe(18);
  });

  it("masasız etkinlikte hepsi 0", async () => {
    const event = await f.createEvent(db);
    expect(await sellableSeatsByCategory(db, event.id, { includeLoca: true })).toEqual({
      standard: 0,
      premium: 0,
      vip: 0,
    });
    expect(await casinoCapacity(db, event.id)).toBe(0);
  });
});
