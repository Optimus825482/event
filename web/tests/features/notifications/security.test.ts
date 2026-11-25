import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { createNotification } from "@/features/notifications/service";
import { createNotificationSchema } from "@/features/notifications/schemas";
import { managerActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { expectDomain, makeActor } from "../reviews/helpers";

const base = { title: "Duyuru", message: "Metin", priority: "medium", audience: "all" } as const;
const parse = (actionUrl: string) => createNotificationSchema.safeParse({ ...base, actionUrl });

describe("actionUrl doğrulaması (açık yönlendirme)", () => {
  it.each([
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "/ /evil.example",
    "/events /x",
    "/events	/x",
    "/a\u0000b",
    "/a​b\u0085c",
    "/\\evil",
    "/\\/evil.example",
    "//evil",
    "/.//evil.example",
    "/x/..//evil.example",
    "/%2e//evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "events",
    "\\\\evil",
  ])("reddeder: %j", (value) => {
    expect(parse(value).success).toBe(false);
  });

  it("kabul eder ve normalleştirilmiş değeri saklar", () => {
    const res = parse("/events/123?x=1#y");
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.actionUrl).toBe("/events/123?x=1#y");
  });

  it("boş değer yok sayılır; ../ gibi yollar origin terk edilmeden normalleşir", () => {
    const empty = parse("  ");
    expect(empty.success && empty.data.actionUrl).toBeUndefined();
    const dots = parse("/a/../../b?q=1");
    expect(dots.success && dots.data.actionUrl).toBe("/b?q=1");
  });
});

describe("createNotification etkinlik bağlantısı", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("Entertainment yöneticisi başkasının oluşturduğu etkinliğe bağlar; olmayan etkinlik not_found; admin her etkinliğe bağlar", async () => {
    const owner = await makeActor(managerActor("entertainment"));
    const other = await makeActor(managerActor("entertainment"));
    const admin = await makeActor("admin");
    const event = await f.createEvent(db, { organizerId: owner.id });
    const input = { ...base, eventId: event.id };

    await expectDomain(createNotification(db, other, { ...base, eventId: crypto.randomUUID() }), "not_found");
    expect((await createNotification(db, other, input)).eventId).toBe(event.id);
    expect((await createNotification(db, admin, input)).eventId).toBe(event.id);
  });
});
