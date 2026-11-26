import { beforeEach, describe, expect, it } from "vitest";
import { holdFlow } from "@/features/checkout/flows";
import { createCoreClient, type CoreClient } from "@/lib/core/client";
import type { EventDetail } from "@/lib/core/contract";
import { createFakeCore, type FakeCore } from "../../helpers/fake-core";

const ctx = { clientIp: "203.0.113.7" };
let fake: FakeCore;
let core: CoreClient;
let ev: EventDetail;

const id = (label: string) => {
  const table = ev.plan.tables.find((t) => t.label === label);
  if (!table) throw new Error(`masa yok: ${label}`);
  return table.id;
};
const input = (label: string, quantity: number, clientKey: string = crypto.randomUUID()) => ({
  eventId: ev.id,
  tableId: id(label),
  quantity,
  clientKey,
});

beforeEach(() => {
  fake = createFakeCore();
  core = createCoreClient({ baseUrl: "http://core.test", secret: fake.secret, fetch: (i, init) => fake.handle(new Request(i, init)) });
  ev = fake.addEvent();
});

describe("holdFlow", () => {
  it("tutma belirteç döner ve güvenilir IP iletilir", async () => {
    const res = await holdFlow(core, input("A1", 2), { clientIp: "203.0.113.7" });
    expect(res).toEqual({ ok: true, data: { orderToken: expect.any(String) } });
    expect(fake.requests.at(-1)?.clientIp).toBe("203.0.113.7");
    expect(fake.free(ev.id, id("A1"))).toBe(6);
  });
  it("aynı clientKey ile yeniden deneme tek sipariş üretir", async () => {
    const i = input("A2", 2);
    const a = await holdFlow(core, i, ctx);
    const b = await holdFlow(core, i, ctx);
    expect(b).toEqual(a);
    expect(fake.free(ev.id, id("A2"))).toBe(6);
  });
  it("yetersiz sandalyede kalan sayıyı ve Türkçe mesajı döner", async () => {
    fake.holdAs(ev.id, id("A3"), 6);
    expect(await holdFlow(core, input("A3", 3), ctx)).toEqual({
      ok: false,
      code: "seats_unavailable",
      message: "Bu masada yalnızca 2 boş sandalye kaldı.",
      details: { tableId: id("A3"), free: 2 },
    });
  });
  it("geçersiz girdi çekirdeğe gitmez", async () => {
    const before = fake.requests.length;
    expect(await holdFlow(core, input("A1", 0), ctx)).toMatchObject({ ok: false, code: "invalid" });
    expect(await holdFlow(core, { ...input("A1", 2), cardNumber: "4111" }, ctx)).toMatchObject({ ok: false, code: "invalid" });
    expect(fake.requests.length).toBe(before);
  });
  it("çekirdek arızasında core_unreachable mesajı", async () => {
    fake.failNext(/orders/, 500);
    expect(await holdFlow(core, input("A1", 2), ctx)).toEqual({
      ok: false,
      code: "core_unreachable",
      message: "Satış sistemine ulaşılamıyor. Lütfen biraz sonra tekrar deneyin.",
    });
  });
});
