import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { teams } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { listEventsForFnb } from "@/features/events/fnb-list";
import { managerActor, memberActor, noAccessActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

const DAY = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY);

describe("listEventsForFnb", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("yaklaşan etkinlikleri tarihe göre listeler; yerleşimi ve ekip sayısını bildirir", async () => {
    const withLayout = await f.createEvent(db, { name: "Yerleşimli", startsAt: inDays(5) });
    await f.createTable(db, withLayout.id);
    await db.insert(teams).values([
      { eventId: withLayout.id, name: "A" },
      { eventId: withLayout.id, name: "B" },
    ]);
    const bare = await f.createEvent(db, { name: "Boş", startsAt: inDays(2) });
    await f.createEvent(db, { name: "Geçmiş", startsAt: inDays(-3) });

    const rows = await listEventsForFnb(db, managerActor("fnb"));

    expect(rows.map((r) => r.name)).toEqual(["Boş", "Yerleşimli"]);
    expect(rows[0]).toMatchObject({ id: bare.id, hasLayout: false, teamCount: 0 });
    expect(rows[1]).toMatchObject({ id: withLayout.id, hasLayout: true, teamCount: 2 });
    expect(rows[1]?.startsAt).toBeInstanceOf(Date);
  });

  it("Entertainment yöneticisi (venues:view) listeyi alır", async () => {
    await f.createEvent(db, { startsAt: inDays(1) });
    await expect(listEventsForFnb(db, managerActor("entertainment"))).resolves.toHaveLength(1);
  });

  it("F&B yöneticisi listeyi alır", async () => {
    await f.createEvent(db, { startsAt: inDays(1) });
    await expect(listEventsForFnb(db, managerActor("fnb"))).resolves.toHaveLength(1);
  });

  it("venues:view var ama events:view yoksa ForbiddenError", async () => {
    await f.createEvent(db, { startsAt: inDays(1) });
    await expect(listEventsForFnb(db, memberActor("fnb", { venues: "v---" }))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("venues:view izni olmayan aktör için ForbiddenError", async () => {
    await expect(listEventsForFnb(db, noAccessActor())).rejects.toBeInstanceOf(ForbiddenError);
  });
});
