import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { getSeatPrices } from "@/features/seating/prices";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { setFinalPrices } from "../../helpers/seating";

const EMPTY = { finalPrice: null, recommendedPrice: null, coefficient: "1.000" };

describe("fiyat okuma", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("satır yokken üç kategori de boş fiyat ve 1.000 katsayı döner", async () => {
    const event = await f.createEvent(db);
    expect(await getSeatPrices(db, event.id)).toEqual({ standard: EMPTY, premium: EMPTY, vip: EMPTY });
  });

  it("yalnızca girilen kategori dolu gelir", async () => {
    const event = await f.createEvent(db);
    await setFinalPrices(db, event.id, { vip: "2500.00" });
    const prices = await getSeatPrices(db, event.id);
    expect(prices.vip.finalPrice).toBe("2500.00");
    expect(prices.standard.finalPrice).toBeNull();
    expect(prices.premium).toEqual(EMPTY);
  });
});
