import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { ForbiddenError } from "@/features/auth/errors";
import type { Actor } from "@/features/auth/session";
import { createAction } from "@/lib/action";
import { ticketingActionDefs } from "@/features/ticketing/action-defs";
import { managerActor, noAccessActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createPaidOrder } from "../../helpers/ticketing";
import { saleEvent } from "./fixtures";

let current: Actor;
vi.mock("@/features/auth/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth/permissions")>()),
  requirePolicyActor: async () => current,
}));

const { loadOrderDetail, loadOrdersOverview } = await import("@/features/ticketing/loaders");

describe("sipariş yükleyicileri ve okuma eylemi: yetkisiz", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("ticketing:view yoksa yükleyiciler ForbiddenError (403) fırlatır", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const order = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 1 }] });
    current = await persistActor(db, managerActor("fnb"));
    await expect(loadOrdersOverview(event.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(loadOrderDetail(event.id, order.orderId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("ordersOverviewAction yetkisizde forbidden döner", async () => {
    const { event } = await saleEvent();
    const actor = await persistActor(db, noAccessActor());
    const result = await createAction({ getActor: async () => actor }).defineAction(ticketingActionDefs.overview)({
      eventId: event.id,
    });
    expect(result).toMatchObject({ ok: false, code: "forbidden" });
  });
});
