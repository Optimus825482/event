import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { events, teams } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import { FNB_LIST_LIMIT, listEventsForFnb } from "@/features/events/fnb-list";
import { managerActor, memberActor, noAccessActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

const DAY = 86_400_000;
/** Şimdiki yerel saatten (APP_TIME_ZONE) yerel gün başlangıcı; uygulamadan bağımsız hesap. */
function localDayStart(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return new Date(
    now.getTime() - ((n("hour") * 60 + n("minute")) * 60 + n("second")) * 1000,
  );
}
const inDays = (n: number) => new Date(Date.now() + n * DAY);

describe("listEventsForFnb", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("yaklaşan etkinlikleri tarihe göre listeler; yerleşimi ve ekip sayısını bildirir", async () => {
    const withLayout = await f.createEvent(db, {
      name: "Yerleşimli",
      startsAt: inDays(5),
    });
    await f.createTable(db, withLayout.id);
    await db.insert(teams).values([
      { eventId: withLayout.id, name: "A" },
      { eventId: withLayout.id, name: "B" },
    ]);
    const bare = await f.createEvent(db, { name: "Boş", startsAt: inDays(2) });
    await f.createEvent(db, { name: "Geçmiş", startsAt: inDays(-3) });

    const { rows, truncated } = await listEventsForFnb(db, managerActor("fnb"));

    expect(truncated).toBe(false);
    expect(rows.map((r) => r.name)).toEqual(["Boş", "Yerleşimli"]);
    expect(rows[0]).toMatchObject({
      id: bare.id,
      hasLayout: false,
      teamCount: 0,
    });
    expect(rows[1]).toMatchObject({
      id: withLayout.id,
      hasLayout: true,
      teamCount: 2,
    });
    expect(rows[1]?.startsAt).toBeInstanceOf(Date);
  });

  it("bugün başlamış etkinlik listelenir; dünkü listelenmez (gün başı Asia/Famagusta)", async () => {
    const dayStart = localDayStart(new Date());
    await f.createEvent(db, {
      name: "Bugün başladı",
      startsAt: new Date(dayStart.getTime() + 60_000),
    });
    await f.createEvent(db, {
      name: "Dün",
      startsAt: new Date(dayStart.getTime() - 3_600_000),
    });

    const { rows } = await listEventsForFnb(db, managerActor("fnb"));

    expect(rows.map((r) => r.name)).toEqual(["Bugün başladı"]);
  });

  it("sınırı aşınca truncated bildirir ve en fazla sınır kadar satır döner", async () => {
    const organizer = await f.createUser(db);
    await db.insert(events).values(
      Array.from({ length: FNB_LIST_LIMIT + 1 }, (_, i) => ({
        name: `E${i}`,
        startsAt: inDays(1 + i / 1000),
        organizerId: organizer.id,
      })),
    );

    const over = await listEventsForFnb(db, managerActor("fnb"));
    expect(over.truncated).toBe(true);
    expect(over.rows).toHaveLength(FNB_LIST_LIMIT);

    await db.delete(events).where(eq(events.name, "E0"));
    const exact = await listEventsForFnb(db, managerActor("fnb"));
    expect(exact.truncated).toBe(false);
    expect(exact.rows).toHaveLength(FNB_LIST_LIMIT);
  });

  it("Entertainment yöneticisi (venues:view) listeyi alır", async () => {
    await f.createEvent(db, { startsAt: inDays(1) });
    await expect(
      listEventsForFnb(db, managerActor("entertainment")),
    ).resolves.toMatchObject({ rows: [{}] });
  });

  it("F&B yöneticisi listeyi alır", async () => {
    await f.createEvent(db, { startsAt: inDays(1) });
    await expect(
      listEventsForFnb(db, managerActor("fnb")),
    ).resolves.toMatchObject({ rows: [{}] });
  });

  it("venues:view var ama events:view yoksa ForbiddenError", async () => {
    await f.createEvent(db, { startsAt: inDays(1) });
    await expect(
      listEventsForFnb(db, memberActor("fnb", { venues: "v---" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("venues:view izni olmayan aktör için ForbiddenError", async () => {
    await expect(listEventsForFnb(db, noAccessActor())).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
