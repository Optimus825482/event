import { beforeEach, describe, expect, it } from "vitest";
import { createCoreClient } from "@/lib/core/client";
import type { EventDetail } from "@/lib/core/contract";
import { createReader, type Reader } from "@/features/plan/read";
import { createFakeCore, type FakeCore } from "../../helpers/fake-core";

let fake: FakeCore;
let reader: Reader;
let ev: EventDetail;
let now = 0;

const availabilityHits = () => fake.requests.filter((r) => r.path.endsWith("/availability")).length;
const detailHits = () => fake.requests.filter((r) => /\/events\/[^/]+$/.test(r.path)).length;

beforeEach(() => {
  now = 0;
  fake = createFakeCore();
  const core = createCoreClient({
    baseUrl: "http://core.test",
    secret: fake.secret,
    fetch: (input, init) => fake.handle(new Request(input, init)),
  });
  reader = createReader({ core, now: () => now });
  ev = fake.addEvent();
});

describe("okuma katmanı", () => {
  it("100 eşzamanlı doluluk isteği çekirdeğe tek istek olur", async () => {
    await Promise.all(Array.from({ length: 100 }, () => reader.availability(ev.id)));
    expect(availabilityHits()).toBe(1);
  });

  it("3 sn içinde çekirdeğe yeniden gidilmez, 3 sn sonra gidilir", async () => {
    await reader.availability(ev.id);
    expect(availabilityHits()).toBe(1);
    now = 2999;
    await reader.availability(ev.id);
    expect(availabilityHits()).toBe(1);
    now = 3001;
    await reader.availability(ev.id);
    expect(availabilityHits()).toBe(2);
  });

  it("listede olmayan 50 rastgele kimlik çekirdeğe doluluk isteği üretmez", async () => {
    for (let i = 0; i < 50; i++) expect(await reader.availability(crypto.randomUUID())).toBeNull();
    expect(availabilityHits()).toBe(0);
    expect(fake.requests.filter((r) => r.path === "/api/sales/v1/events").length).toBe(1);
  });

  it("büyük harfli kimlik küçük harfe indirilip aynı kayıtla eşleşir", async () => {
    const upper = ev.id.toUpperCase();
    expect((await reader.event(upper))?.id).toBe(ev.id);
    expect(await reader.availability(upper)).not.toBeNull();
    expect(availabilityHits()).toBe(1);
  });

  it("UUID olmayan kimlik çekirdeğe hiç gitmez", async () => {
    expect(await reader.event("../orders")).toBeNull();
    expect(await reader.availability("../orders")).toBeNull();
    expect(fake.requests).toHaveLength(0);
  });

  it("etkinlik ayrıntısı 30 sn önbellekte kalır", async () => {
    expect((await reader.event(ev.id))?.id).toBe(ev.id);
    await reader.event(ev.id);
    expect(detailHits()).toBe(1);
    now = 30_001;
    await reader.event(ev.id);
    expect(detailHits()).toBe(2);
  });

  it("çekirdek arızası fırlatılır ve önbelleğe alınmaz", async () => {
    await reader.events();
    fake.failNext(/availability/, 502);
    await expect(reader.availability(ev.id)).rejects.toMatchObject({ code: "core_unreachable" });
    const result = await reader.availability(ev.id);
    expect(result?.tables.length).toBeGreaterThan(0);
  });
});
