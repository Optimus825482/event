import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { ForbiddenError } from "@/features/auth/errors";
import { assertCanViewReports, getPeriodReport } from "@/features/reports/service";
import { managerActor } from "../../helpers/actors";
import { insertArchive } from "../../helpers/archive";
import { truncateAll } from "../../helpers/db";
import { createEvent } from "../../helpers/factories";

beforeEach(truncateAll);

const actor = managerActor("entertainment");
const names = async (from: string, to: string) =>
  (await getPeriodReport(db, actor, { from, to })).rows.map((r) => r.eventName);

describe("dönem raporu", () => {
  it("gece yarısına yakın etkinlik Kıbrıs gününe göre aya düşer", async () => {
    await insertArchive(db, { eventName: "Ocak son", startsAt: new Date("2027-01-31T21:59:59Z") });
    await insertArchive(db, { eventName: "Şubat ilk", startsAt: new Date("2027-01-31T22:00:00Z") });
    await insertArchive(db, { eventName: "Temmuz ilk", startsAt: new Date("2027-06-30T21:30:00Z") });
    expect(await names("2027-01-01", "2027-01-31")).toEqual(["Ocak son"]);
    expect(await names("2027-02-01", "2027-02-28")).toEqual(["Şubat ilk"]);
    expect(await names("2027-06-01", "2027-06-30")).toEqual([]);
    expect(await names("2027-07-01", "2027-07-01")).toEqual(["Temmuz ilk"]);
  });

  it("bitiş günü dahildir", async () => {
    await insertArchive(db, { eventName: "Son an", startsAt: new Date("2027-03-28T20:59:59Z") });
    await insertArchive(db, { eventName: "Ertesi gün", startsAt: new Date("2027-03-28T21:00:00Z") });
    expect(await names("2027-03-28", "2027-03-28")).toEqual(["Son an"]);
    expect(await names("2027-03-01", "2027-03-28")).toEqual(["Son an"]);
  });

  it("yalnızca arşivlenmiş etkinlikler listelenir", async () => {
    await insertArchive(db, { eventName: "Arşivli", startsAt: new Date("2027-05-10T18:00:00Z") });
    await createEvent(db, { name: "Aktif", status: "active", startsAt: new Date("2027-05-11T18:00:00Z") });
    await createEvent(db, { name: "Tamamlanmış arşivsiz", status: "completed", startsAt: new Date("2027-05-12T18:00:00Z") });
    expect(await names("2027-05-01", "2027-05-31")).toEqual(["Arşivli"]);
  });

  it("toplamlar demo'yu ayrı tutar", async () => {
    await insertArchive(db, {
      startsAt: new Date("2027-05-10T18:00:00Z"),
      ticketsSold: 4,
      ticketRevenue: "550.50",
      demoTicketsSold: 2,
      demoTicketRevenue: "501.00",
    });
    await insertArchive(db, {
      startsAt: new Date("2027-05-11T18:00:00Z"),
      ticketsSold: 0,
      ticketRevenue: "0.00",
      demoTicketsSold: 6,
      demoTicketRevenue: "1051.50",
    });
    const report = await getPeriodReport(db, actor, { from: "2027-05-01", to: "2027-05-31" });
    expect(report.totals).toHaveLength(1);
    expect(report.totals[0]).toMatchObject({
      currency: "TRY",
      eventCount: 2,
      ticketsSold: 4,
      ticketRevenue: "550.50",
      demoTicketsSold: 8,
      demoTicketRevenue: "1552.50",
      netActual: "550.50",
    });
  });

  it("satırlar etkinlik tarihine göre artan", async () => {
    await insertArchive(db, { eventName: "C", startsAt: new Date("2027-05-20T18:00:00Z") });
    await insertArchive(db, { eventName: "A", startsAt: new Date("2027-05-02T18:00:00Z") });
    await insertArchive(db, { eventName: "B", startsAt: new Date("2027-05-10T18:00:00Z") });
    expect(await names("2027-05-01", "2027-05-31")).toEqual(["A", "B", "C"]);
  });

  it("arşiv izni olmayan rapor alamaz", async () => {
    await expect(getPeriodReport(db, managerActor("fnb"), { from: "2027-05-01", to: "2027-05-31" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("geçersiz dönem olsa bile arşiv izni olmayan sayfa kapısında reddedilir", () => {
    expect(() => assertCanViewReports(managerActor("fnb"))).toThrow(ForbiddenError);
    expect(() => assertCanViewReports(actor)).not.toThrow();
  });
});

describe("getPeriodReport girdi doğrulaması", () => {
  it("geçersiz dönem hata fırlatır", async () => {
    await expect(getPeriodReport(db, actor, { from: "2027-02-30", to: "2027-01-01" })).rejects.toThrow();
    await expect(getPeriodReport(db, actor, { from: "2027-03-01", to: "2027-01-01" })).rejects.toThrow();
  });
});
