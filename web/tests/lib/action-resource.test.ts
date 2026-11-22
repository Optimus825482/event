import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { db } from "@/db/client";
import type { Actor } from "@/features/auth/session";
import { createAction } from "@/lib/action";
import { truncateAll } from "../helpers/db";
import { createStaff } from "../helpers/factories";
import { makeActor } from "../features/reviews/helpers";

const input = z.object({ teamLeaderStaffId: z.uuid() });

function actionFor(actor: Actor) {
  return createAction({ getActor: async () => actor }).defineAction;
}

describe("defineAction resource seçeneği", () => {
  let leader: Actor;
  let ownStaffId: string;

  beforeEach(async () => {
    await truncateAll();
    ownStaffId = (await createStaff(db, { fullName: "Lider Bir" })).id;
    leader = await makeActor("leader", ownStaffId);
  });

  it("resource yokken yetki girdi doğrulamasından önce denetlenir", async () => {
    const handler = vi.fn(async () => "x");
    // leader reviews/delete yetkisine sahip değil; girdi de geçersiz: forbidden gelmeli.
    const run = actionFor(leader)({ module: "reviews", verb: "delete", input, handler });

    expect(await run({ teamLeaderStaffId: "geçersiz" })).toMatchObject({ ok: false, code: "forbidden" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("resource varken girdi önce doğrulanır, çözülen kaynak authorize'a geçirilir", async () => {
    const resource = vi.fn(({ input: parsed }: { input: z.infer<typeof input> }) => ({
      teamLeaderStaffId: parsed.teamLeaderStaffId,
    }));
    const handler = vi.fn(async () => "ok");
    const run = actionFor(leader)({ module: "reviews", verb: "view", input, resource, handler });

    // Geçersiz girdi: yetki sorusuna gelmeden invalid.
    expect(await run({ teamLeaderStaffId: "geçersiz" })).toMatchObject({ ok: false, code: "invalid" });
    expect(resource).not.toHaveBeenCalled();

    // Lider kendi ekibinin kaynağında yetkili.
    expect(await run({ teamLeaderStaffId: ownStaffId })).toEqual({ ok: true, data: "ok" });
    expect(resource).toHaveBeenCalledWith({ actor: leader, input: { teamLeaderStaffId: ownStaffId } });
    expect(handler).toHaveBeenCalledTimes(1);

    // Başka liderin ekibi: forbidden, handler çalışmaz.
    const otherStaffId = (await createStaff(db, { fullName: "Lider İki" })).id;
    expect(await run({ teamLeaderStaffId: otherStaffId })).toMatchObject({ ok: false, code: "forbidden" });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
