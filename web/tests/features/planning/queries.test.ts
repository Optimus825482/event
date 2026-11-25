import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import type { Actor } from "@/features/auth/session";
import { adminActor, noAccessActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

let current: Actor;
vi.mock("@/features/auth/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth/permissions")>()),
  requirePolicyActor: async () => current,
}));

const { loadPlanningPanel } = await import("@/features/planning/queries");

describe("loadPlanningPanel", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("events:view yoksa null döner (etkinlik var olsa bile)", async () => {
    const event = await f.createEvent(db);
    current = await persistActor(db, noAccessActor());
    expect(await loadPlanningPanel(event.id)).toBeNull();
  });

  it("geçersiz uuid için null döner", async () => {
    current = await persistActor(db, adminActor());
    expect(await loadPlanningPanel("not-a-uuid")).toBeNull();
  });

  it("olmayan etkinlik için null döner", async () => {
    current = await persistActor(db, adminActor());
    expect(await loadPlanningPanel("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("yetkili aktör için panel durumunu döner", async () => {
    const event = await f.createEvent(db);
    current = await persistActor(db, adminActor());
    expect(await loadPlanningPanel(event.id)).toMatchObject({ eventId: event.id, stage: "defined" });
  });
});
