import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { eventArchives, events } from "@/db/schema";
import { changeEventStatus } from "@/features/events/service";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

vi.mock("@/features/archive/snapshot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/archive/snapshot")>()),
  archiveEvent: vi.fn(async () => {
    throw new Error("arşiv yazılamadı");
  }),
}));

beforeEach(truncateAll);

describe("tamamlanma geri alma", () => {
  it("arşiv yazımı başarısız olursa durum değişmez", async () => {
    const actor = await persistActor(db, managerActor("entertainment"));
    const event = await f.createEvent(db, { status: "active" });
    await expect(changeEventStatus(db, actor, { id: event.id, status: "completed" })).rejects.toThrow(
      "arşiv yazılamadı",
    );
    const [row] = await db.select().from(events).where(eq(events.id, event.id));
    expect(row!.status).toBe("active");
    expect(await db.select().from(eventArchives)).toHaveLength(0);
  });
});
