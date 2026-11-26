import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import type { Actor } from "@/features/auth/session";
import { ticketingActionDefs } from "@/features/ticketing/action-defs";
import { createAction } from "@/lib/action";
import { managerActor, memberActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createPaidOrder } from "../../helpers/ticketing";
import { saleEvent } from "./fixtures";

function as(actor: Actor | null) {
  return createAction({ getActor: async () => actor }).defineAction;
}

describe("sipariş eylemleri", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  async function paid() {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const order = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 1 }] });
    return { eventId: event.id, orderId: order.orderId };
  }

  it("yeniden gönderim ticketing:edit ister", async () => {
    const order = await paid();
    const viewer = await persistActor(db, memberActor("entertainment", { ticketing: "v---" }));
    const result = await as(viewer)(ticketingActionDefs.resendEmail)({ orderId: order.orderId });
    expect(result).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("SMTP yokken anlaşılır hata döner", async () => {
    const order = await paid();
    const manager = await persistActor(db, managerActor("entertainment"));
    const result = await as(manager)(ticketingActionDefs.resendEmail)({ orderId: order.orderId });
    expect(result).toMatchObject({ ok: false, code: "conflict" });
    expect(!result.ok && result.message).toContain("E-posta gönderilemiyor: SMTP ayarları yapılandırılmamış.");
  });

  it("geçersiz sipariş kimliği invalid", async () => {
    const manager = await persistActor(db, managerActor("entertainment"));
    const result = await as(manager)(ticketingActionDefs.resendEmail)({ orderId: "x" });
    expect(result).toMatchObject({ ok: false, code: "invalid", fieldErrors: { orderId: ["Geçersiz sipariş"] } });
  });

  it("canlı yenileme eylemi ticketing:view ister", async () => {
    const order = await paid();
    const viewer = await persistActor(db, memberActor("entertainment", { ticketing: "v---" }));
    expect(await as(viewer)(ticketingActionDefs.overview)({ eventId: order.eventId })).toMatchObject({ ok: true });
    const fnb = await persistActor(db, managerActor("fnb"));
    expect(await as(fnb)(ticketingActionDefs.overview)({ eventId: order.eventId })).toMatchObject({
      ok: false,
      code: "forbidden",
    });
  });
});
