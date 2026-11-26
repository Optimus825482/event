import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { db, pool, type Db } from "@/db/client";
import * as schema from "@/db/schema";
import { eventStaffAssignments, tableGroups, tableGroupTables } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { REVIEW_MESSAGES } from "@/features/reviews/labels";
import {
  REVIEW_BASIS_LABELS,
  assertCanReview,
  eventStaffIds,
  reviewEventIds,
  reviewableStaff,
  reviewableStaffByEvent,
  reviewerStaffIdsFor,
  type ReviewBasis,
} from "@/features/reviews/authority";
import { assistantActor, managerActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { addTeamMember, assignStaffToTables, createSectionHead, createTeam } from "../../helpers/fnb";
import { scopedTeams } from "@/features/reviews/leader-scope";
import { listReviewableEvents } from "@/features/reviews/queries";
import { expectDomain, expectForbidden, makeActor, makeLeader } from "./helpers";

/**
 * Etkinlik E: ekip T (lider C; üyeler W1, W2); masa grubu G (süpervizör S, ekip T, masalar A1, A2);
 * W3 ekipsiz, A1'e atanmış; kısım sorumlusu H; pasif ekip P (lider C, üye W8).
 * İkinci etkinlik E2: C'nin lideri olduğu ekipte W9.
 */
async function setupHierarchy() {
  const manager = await makeActor(managerActor("fnb"));
  const event = await f.createEvent(db, { organizerId: manager.id, startsAt: new Date("2027-01-10T18:00:00Z") });
  const event2 = await f.createEvent(db, { organizerId: manager.id, startsAt: new Date("2027-02-10T18:00:00Z") });

  const C = await f.createStaff(db, { fullName: "Kaptan C" });
  const W1 = await f.createStaff(db, { fullName: "Garson W1" });
  const W2 = await f.createStaff(db, { fullName: "Garson W2" });
  const S = await f.createStaff(db, { fullName: "Süpervizör S" });
  const W3 = await f.createStaff(db, { fullName: "Garson W3" });
  const H = await f.createStaff(db, { fullName: "Kısım H" });
  const W8 = await f.createStaff(db, { fullName: "Garson W8" });
  const W9 = await f.createStaff(db, { fullName: "Garson W9" });

  const T = await createTeam(db, { eventId: event.id, leaderStaffId: C.id, name: "T" });
  await addTeamMember(db, T.id, W1.id);
  await addTeamMember(db, T.id, W2.id);

  const A1 = await f.createTable(db, event.id, { label: "A1" });
  const A2 = await f.createTable(db, event.id, { label: "A2" });
  const G = await f.createTableGroup(db, event.id, { name: "G", supervisorStaffId: S.id, teamId: T.id });
  await db.insert(tableGroupTables).values([
    { eventId: event.id, tableGroupId: G.id, tableId: A1.id },
    { eventId: event.id, tableGroupId: G.id, tableId: A2.id },
  ]);
  await assignStaffToTables(db, { eventId: event.id, staffId: W3.id, tableIds: [A1.id] });
  await createSectionHead(db, { eventId: event.id, staffId: H.id });

  const P = await createTeam(db, { eventId: event.id, leaderStaffId: C.id, isActive: false, name: "P" });
  await addTeamMember(db, P.id, W8.id);

  const T2 = await createTeam(db, { eventId: event2.id, leaderStaffId: C.id, name: "T2" });
  await addTeamMember(db, T2.id, W9.id);

  const actors = {
    C: await makeLeader(C.id),
    S: await makeLeader(S.id),
    H: await makeLeader(H.id),
  };
  return { manager, event, event2, C, W1, W2, S, W3, H, W8, W9, T, P, T2, G, A2, actors };
}

type World = Awaited<ReturnType<typeof setupHierarchy>>;

async function mapOf(w: World, actor: Actor): Promise<Record<string, ReviewBasis[]>> {
  return Object.fromEntries(await reviewableStaff(db, actor, w.event.id));
}

describe("hiyerarşik değerlendirme yetkisi", () => {
  let w: World;

  beforeEach(async () => {
    await truncateAll();
    w = await setupHierarchy();
  });

  it("dayanak etiketleri Türkçedir", () => {
    expect(REVIEW_BASIS_LABELS).toEqual({
      captain: "Kaptan",
      supervisor: "Şef / Süpervizör",
      section_head: "Kısım Sorumlusu",
      manager: "F&B Yönetimi",
    });
  });

  it("etkinlik personeli: etkin ekipler, süpervizörler, atananlar ve kısım sorumluları", async () => {
    const ids = await eventStaffIds(db, w.event.id);
    expect([...ids].sort()).toEqual([w.C.id, w.W1.id, w.W2.id, w.S.id, w.W3.id, w.H.id].sort());
  });

  it("kaptan yalnızca kendi ekibinin üyelerini görür", async () => {
    expect(await mapOf(w, w.actors.C)).toEqual({ [w.W1.id]: ["captain"], [w.W2.id]: ["captain"] });
  });

  it("süpervizör grubunun ekibini, kaptanını ve masalarına atananları görür", async () => {
    expect(await mapOf(w, w.actors.S)).toEqual({
      [w.C.id]: ["supervisor"],
      [w.W1.id]: ["supervisor"],
      [w.W2.id]: ["supervisor"],
      [w.W3.id]: ["supervisor"],
    });
  });

  it("kısım sorumlusu etkinlikteki herkesi görür, kendini görmez", async () => {
    const map = await mapOf(w, w.actors.H);
    expect(map).toEqual({
      [w.C.id]: ["section_head"],
      [w.S.id]: ["section_head"],
      [w.W1.id]: ["section_head"],
      [w.W2.id]: ["section_head"],
      [w.W3.id]: ["section_head"],
    });
    expect(map[w.H.id]).toBeUndefined();
  });

  it("süpervizör ekibin üyesiyse kaptan onu görür, kendisi kendini görmez", async () => {
    await addTeamMember(db, w.T.id, w.S.id);
    expect((await mapOf(w, w.actors.C))[w.S.id]).toEqual(["captain"]);
    expect((await mapOf(w, w.actors.S))[w.S.id]).toBeUndefined();
  });

  it("iki dayanaklı değerlendirici", async () => {
    await db.update(tableGroups).set({ supervisorStaffId: w.C.id }).where(eq(tableGroups.id, w.G.id));
    const map = await mapOf(w, w.actors.C);
    expect(map[w.W1.id]).toEqual(["captain", "supervisor"]);
    expect(map[w.W3.id]).toEqual(["supervisor"]);
    expect(map[w.C.id]).toBeUndefined();
  });

  it("F&B yöneticisi tüm etkinlik personelini 'manager' dayanağıyla görür", async () => {
    const map = await mapOf(w, w.manager);
    expect(Object.keys(map).sort()).toEqual([w.C.id, w.W1.id, w.W2.id, w.S.id, w.W3.id, w.H.id].sort());
    expect(Object.values(map).every((b) => b.length === 1 && b[0] === "manager")).toBe(true);
  });

  it("yönetici kendi personel kaydını görmez", async () => {
    // Yetki yalnızca aktör alanlarından okunur; personel kaydı başka kullanıcıya bağlı olduğu için kalıcılaştırılmaz.
    const managerWithStaff = managerActor("fnb", { staffId: w.H.id });
    expect((await mapOf(w, managerWithStaff))[w.H.id]).toBeUndefined();
  });

  it("staffId'siz F&B kullanıcısı hiçbir şey görmez", async () => {
    expect(await mapOf(w, await makeLeader(null))).toEqual({});
  });

  it("pasif ekip ve başka etkinlik dayanak üretmez", async () => {
    const map = await mapOf(w, w.actors.C);
    expect(map[w.W8.id]).toBeUndefined();
    expect(map[w.W9.id]).toBeUndefined();
  });

  it("reviewerStaffIdsFor(E, W3) = H ve S'nin kimlikleri, kimliğe göre sıralı; W3'ün kendisi yok", async () => {
    expect(await reviewerStaffIdsFor(db, w.event.id, w.W3.id)).toEqual([w.H.id, w.S.id].sort());
    expect(await reviewerStaffIdsFor(db, w.event.id, w.W1.id)).toEqual([w.C.id, w.H.id, w.S.id].sort());
    expect(await reviewerStaffIdsFor(db, w.event.id, w.H.id)).toEqual([]);
    expect(await reviewerStaffIdsFor(db, w.event.id, w.W9.id)).toEqual([]);
  });

  it("assertCanReview", async () => {
    await expectForbidden(assertCanReview(db, w.actors.C, w.event.id, w.W3.id, "edit"));
    expect(await assertCanReview(db, w.actors.S, w.event.id, w.W3.id, "edit")).toEqual(["supervisor"]);
    const notOnTeam = await expectDomain(assertCanReview(db, w.actors.C, w.event.id, w.W9.id, "edit"), "not_found");
    expect(notOnTeam.message).toBe(REVIEW_MESSAGES.notOnTeam);
    const self = await expectDomain(assertCanReview(db, w.actors.S, w.event.id, w.S.id, "edit"), "conflict");
    expect(self.message).toBe(REVIEW_MESSAGES.self);
    const assistant = await makeActor(assistantActor("fnb"));
    await expectForbidden(assertCanReview(db, assistant, w.event.id, w.W1.id, "delete"));
    expect(await assertCanReview(db, w.manager, w.event.id, w.W1.id, "delete")).toEqual(["manager"]);
  });

  it("değerlendirme izni olmayan kullanıcı kendisi için de ForbiddenError alır", async () => {
    const casino = managerActor("casino", { staffId: w.S.id });
    await expectForbidden(assertCanReview(db, casino, w.event.id, w.S.id, "edit"));
    await expectForbidden(assertCanReview(db, casino, w.event.id, w.W1.id, "edit"));
    expect(await mapOf(w, casino)).toEqual({});
  });

  it("reviewEventIds: C için [E, E2]; H için [E]; yönetici için [E, E2]", async () => {
    expect(await reviewEventIds(db, w.actors.C)).toEqual([w.event.id, w.event2.id]);
    expect(await reviewEventIds(db, w.actors.H)).toEqual([w.event.id]);
    expect(await reviewEventIds(db, w.manager)).toEqual([w.event.id, w.event2.id]);
  });

  it("reviewEventIds: tek personeli yöneticinin kendisi olan etkinlik yöneticiye dönmez", async () => {
    const own = await f.createStaff(db, { fullName: "Yönetici Personeli" });
    const lonely = await f.createEvent(db, { organizerId: w.manager.id, startsAt: new Date("2027-03-10T18:00:00Z") });
    await createSectionHead(db, { eventId: lonely.id, staffId: own.id });
    // Yetki aktör alanlarından okunur; kalıcılaştırmaya gerek yok.
    const managerWithStaff = managerActor("fnb", { staffId: own.id });
    expect(await reviewEventIds(db, managerWithStaff)).toEqual([w.event.id, w.event2.id]);
    expect(await reviewEventIds(db, w.manager)).toEqual([w.event.id, w.event2.id, lonely.id]);
  });

  it("reviewEventIds sorgu sayısı etkinlik sayısıyla artmaz", async () => {
    let queries = 0;
    const counted = drizzle(pool, { schema, logger: { logQuery: () => void queries++ } }) as unknown as Db;
    const countFor = async (actor: Actor) => {
      queries = 0;
      const ids = await reviewEventIds(counted, actor);
      return { ids: ids.length, queries };
    };
    const before = { C: await countFor(w.actors.C), manager: await countFor(w.manager) };
    expect(before.C.ids).toBe(2);
    expect(before.manager.ids).toBe(2);
    expect(before.manager.queries).toBe(1);

    for (let i = 0; i < 4; i += 1) {
      const e = await f.createEvent(db, { organizerId: w.manager.id });
      const worker = await f.createStaff(db);
      const team = await createTeam(db, { eventId: e.id, leaderStaffId: w.C.id });
      await addTeamMember(db, team.id, worker.id);
    }
    const after = { C: await countFor(w.actors.C), manager: await countFor(w.manager) };
    expect(after.C.ids).toBe(6);
    expect(after.manager.ids).toBe(6);
    expect(after.C.queries).toBe(before.C.queries);
    // Hiyerarşi yolu: aday sorgusu + toplu yükleme (en fazla 6).
    expect(after.C.queries).toBeLessThanOrEqual(7);
    expect(after.manager.queries).toBe(before.manager.queries);
  });

  it("pasif ekibe bağlı grup süpervizöre dayanak üretmez", async () => {
    const S2 = await f.createStaff(db, { fullName: "Süpervizör S2" });
    await f.createTableGroup(db, w.event.id, { name: "G2", supervisorStaffId: S2.id, teamId: w.P.id });
    const s2 = await makeLeader(S2.id);
    expect(await mapOf(w, s2)).toEqual({});
    expect(await reviewerStaffIdsFor(db, w.event.id, w.C.id)).toEqual([w.H.id, w.S.id].sort());
    expect(await reviewEventIds(db, s2)).toEqual([]);
  });

  it("başka etkinliğin ekibine bağlı grup süpervizöre dayanak üretmez", async () => {
    const S3 = await f.createStaff(db, { fullName: "Süpervizör S3" });
    await f.createTableGroup(db, w.event.id, { name: "G3", supervisorStaffId: S3.id, teamId: w.T2.id });
    const s3 = await makeLeader(S3.id);
    expect(await mapOf(w, s3)).toEqual({});
    expect(await reviewerStaffIdsFor(db, w.event.id, w.C.id)).toEqual([w.H.id, w.S.id].sort());
    expect(await reviewerStaffIdsFor(db, w.event2.id, w.W9.id)).toEqual([w.C.id]);
    await expectDomain(assertCanReview(db, s3, w.event.id, w.W9.id, "edit"), "not_found");
  });

  it("toplu yüklemede başka etkinliğin ekibine bağlı grup o etkinliği açmaz", async () => {
    // S3 iki etkinlikte de aday: E'de G3'ün süpervizörü (ekibi E2'nin T2'si, masası yok), E2'de kısım sorumlusu.
    // E'ye yalnızca etkinlikler arası bağla ulaşılabilirdi; iki etkinlik aynı toplu yüklemeye girer.
    const S3 = await f.createStaff(db, { fullName: "Süpervizör S3" });
    await f.createTableGroup(db, w.event.id, { name: "G3", supervisorStaffId: S3.id, teamId: w.T2.id });
    await createSectionHead(db, { eventId: w.event2.id, staffId: S3.id });
    const s3 = await makeLeader(S3.id);
    expect(await reviewEventIds(db, s3)).toEqual([w.event2.id]);
  });

  it("pasif atama etkinlik personeli saymaz ve dayanak üretmez", async () => {
    const W4 = await f.createStaff(db, { fullName: "Garson W4" });
    const { assignmentId } = await assignStaffToTables(db, { eventId: w.event.id, staffId: W4.id, tableIds: [w.A2.id] });
    await db.update(eventStaffAssignments).set({ isActive: false }).where(eq(eventStaffAssignments.id, assignmentId));
    expect((await eventStaffIds(db, w.event.id)).has(W4.id)).toBe(false);
    expect((await mapOf(w, w.actors.S))[W4.id]).toBeUndefined();
    expect((await mapOf(w, w.manager))[W4.id]).toBeUndefined();
    expect(await reviewerStaffIdsFor(db, w.event.id, W4.id)).toEqual([]);
    await expectDomain(assertCanReview(db, w.manager, w.event.id, W4.id, "edit"), "not_found");
  });

  it("yalnızca pasif ataması olan etkinlik yöneticiye dönmez", async () => {
    const e = await f.createEvent(db, { organizerId: w.manager.id });
    const W5 = await f.createStaff(db);
    await f.createAssignment(db, { eventId: e.id, staffId: W5.id, isActive: false });
    expect(await reviewEventIds(db, w.manager)).toEqual([w.event.id, w.event2.id]);
  });
});

describe("toplu değerlendirilebilir personel (reviewableStaffByEvent)", () => {
  let w: World;

  beforeEach(async () => {
    await truncateAll();
    w = await setupHierarchy();
  });

  /** Toplu sonuç, etkinlik başına `reviewableStaff` ile birebir aynı olmalı. */
  async function expectEquivalent(actor: Actor, eventIds: string[]) {
    const batched = await reviewableStaffByEvent(db, actor, eventIds);
    expect([...batched.keys()].sort()).toEqual([...new Set(eventIds)].sort());
    for (const id of eventIds) {
      const single = Object.fromEntries(await reviewableStaff(db, actor, id));
      expect(Object.fromEntries(batched.get(id) ?? new Map())).toEqual(single);
    }
    return batched;
  }

  it("yönetici, kaptan, loca süpervizörü ve kısım sorumlusu için etkinlik başına sonuçla aynı", async () => {
    // E2'de loca grubu: süpervizör L, loca masası L1'e atanmış W6; E'de L kısım sorumlusu değil.
    const L = await f.createStaff(db, { fullName: "Loca Süpervizörü L" });
    const W6 = await f.createStaff(db, { fullName: "Garson W6" });
    const L1 = await f.createTable(db, w.event2.id, { label: "L1", isLoca: true });
    const LG = await f.createTableGroup(db, w.event2.id, { name: "Loca L1", supervisorStaffId: L.id, groupType: "loca" });
    await db.insert(tableGroupTables).values({ eventId: w.event2.id, tableGroupId: LG.id, tableId: L1.id });
    await assignStaffToTables(db, { eventId: w.event2.id, staffId: W6.id, tableIds: [L1.id] });
    // H, E2'de de kısım sorumlusu; S3'ün E'deki grubu E2'nin ekibine bağlı (etkinlikler arası bağ dayanak üretmez).
    await createSectionHead(db, { eventId: w.event2.id, staffId: w.H.id });
    const S3 = await f.createStaff(db, { fullName: "Süpervizör S3" });
    await f.createTableGroup(db, w.event.id, { name: "G3", supervisorStaffId: S3.id, teamId: w.T2.id });
    await createSectionHead(db, { eventId: w.event2.id, staffId: S3.id });

    const events = [w.event.id, w.event2.id];
    const loca = await makeLeader(L.id);
    const s3 = await makeLeader(S3.id);
    await expectEquivalent(w.manager, events);
    await expectEquivalent(w.actors.C, events);
    await expectEquivalent(w.actors.S, events);
    await expectEquivalent(w.actors.H, events);
    const forLoca = await expectEquivalent(loca, events);
    expect(Object.fromEntries(forLoca.get(w.event2.id) ?? new Map())).toEqual({ [W6.id]: ["supervisor"] });
    expect(forLoca.get(w.event.id)?.size).toBe(0);
    const forS3 = await expectEquivalent(s3, events);
    expect(forS3.get(w.event.id)?.size).toBe(0);
    expect(forS3.get(w.event2.id)?.has(w.W9.id)).toBe(true);
  });

  it("izinsiz ve staffId'siz aktör için her etkinlik boş; boş liste boş harita", async () => {
    const events = [w.event.id, w.event2.id];
    for (const actor of [managerActor("casino", { staffId: w.S.id }), await makeLeader(null)]) {
      const batched = await expectEquivalent(actor, events);
      expect([...batched.values()].every((m) => m.size === 0)).toBe(true);
    }
    expect((await reviewableStaffByEvent(db, w.manager, [])).size).toBe(0);
  });

  it("scopedTeams ve listReviewableEvents sorgu sayısı etkinlik sayısıyla artmaz", async () => {
    let queries = 0;
    const counted = drizzle(pool, { schema, logger: { logQuery: () => void queries++ } }) as unknown as Db;
    const countFor = async (actor: Actor) => {
      queries = 0;
      const teams = await scopedTeams(counted, actor);
      const scopeQueries = queries;
      queries = 0;
      const listed = await listReviewableEvents(counted, actor);
      return { teams: teams.length, events: listed.length, scopeQueries, listQueries: queries };
    };
    const before = { C: await countFor(w.actors.C), manager: await countFor(w.manager) };
    expect(before.C.events).toBe(2);
    expect(before.manager.events).toBe(2);

    for (let i = 0; i < 4; i += 1) {
      const e = await f.createEvent(db, { organizerId: w.manager.id });
      const worker = await f.createStaff(db);
      const team = await createTeam(db, { eventId: e.id, leaderStaffId: w.C.id });
      await addTeamMember(db, team.id, worker.id);
    }
    const after = { C: await countFor(w.actors.C), manager: await countFor(w.manager) };
    expect(after.C.events).toBe(6);
    expect(after.manager.events).toBe(6);
    expect(after.C.teams).toBe(before.C.teams + 4);
    for (const who of ["C", "manager"] as const) {
      expect(after[who].scopeQueries).toBe(before[who].scopeQueries);
      expect(after[who].listQueries).toBe(before[who].listQueries);
    }
  });
});

describe("hiyerarşi yetkisi aktörün personel kaydının etkin olmasını gerektirir", () => {
  let w: World;

  beforeEach(async () => {
    await truncateAll();
    w = await setupHierarchy();
  });

  const deactivate = (id: string, status: "inactive" | "terminated" = "inactive") =>
    db.update(schema.staff).set({ status }).where(eq(schema.staff.id, id));

  const roles = [
    ["kaptan", (x: World) => x.C, (x: World) => x.actors.C],
    ["süpervizör", (x: World) => x.S, (x: World) => x.actors.S],
    ["kısım sorumlusu", (x: World) => x.H, (x: World) => x.actors.H],
  ] as const;

  for (const [name, person, actorOf] of roles) {
    for (const status of ["inactive", "terminated"] as const) {
      it(`${name}: personel kaydı ${status} ise kimseyi değerlendiremez, etkinlik görmez`, async () => {
        const before = await mapOf(w, actorOf(w));
        expect(Object.keys(before).length).toBeGreaterThan(0);
        await deactivate(person(w).id, status);
        expect(await mapOf(w, actorOf(w))).toEqual({});
        expect(await reviewableStaffByEvent(db, actorOf(w), [w.event.id, w.event2.id])).toEqual(
          new Map([
            [w.event.id, new Map()],
            [w.event2.id, new Map()],
          ]),
        );
        expect(await reviewEventIds(db, actorOf(w))).toEqual([]);
        await expectForbidden(assertCanReview(db, actorOf(w), w.event.id, w.W1.id, "edit"));
      });
    }

    it(`${name}: etkin kayıt değişmez`, async () => {
      expect(Object.keys(await mapOf(w, actorOf(w))).length).toBeGreaterThan(0);
      expect((await reviewEventIds(db, actorOf(w))).length).toBeGreaterThan(0);
    });
  }

  it("reviewerStaffIdsFor pasif personeli değerlendirici olarak listelemez", async () => {
    await deactivate(w.S.id);
    expect(await reviewerStaffIdsFor(db, w.event.id, w.W3.id)).toEqual([w.H.id]);
    await deactivate(w.C.id);
    expect(await reviewerStaffIdsFor(db, w.event.id, w.W1.id)).toEqual([w.H.id]);
    await deactivate(w.H.id);
    expect(await reviewerStaffIdsFor(db, w.event.id, w.W1.id)).toEqual([]);
  });

  it("pasif personel değerlendirilebilir kalır; yönetici yetkisi etkilenmez", async () => {
    await deactivate(w.W1.id);
    expect(Object.keys(await mapOf(w, w.actors.C))).toContain(w.W1.id);
    expect(Object.keys(await mapOf(w, w.manager)).length).toBeGreaterThan(0);
  });
});
