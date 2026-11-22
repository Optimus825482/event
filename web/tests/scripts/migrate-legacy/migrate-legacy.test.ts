import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyQrToken } from "@/features/reservations/qr-token";
import { openLegacy } from "../../../scripts/migrate-legacy/legacy";
import type { Finding, MigrationReport } from "../../../scripts/migrate-legacy/report";
import { renderSummary, renderText } from "../../../scripts/migrate-legacy/report";
import { runMigration } from "../../../scripts/migrate-legacy/run";
import { checksum, createLegacyDb, createTargetDb, dbUrl, dropDb, totalRows, uniqueDbName, withClient } from "./harness";
import { IDS, LEGACY_PASSWORD, seedLegacy } from "./seed";

const LEGACY = uniqueDbName("eventflow_legacy_test");
const TARGET = uniqueDbName("eventflow_etl_test");
const BARE = uniqueDbName("eventflow_etl_test", "bare");
const E = IDS.events;
const R = IDS.reservations;

let before: Record<string, string>;
let dry: MigrationReport;
let real: MigrationReport;

const opts = (dryRun: boolean) => ({
  legacyUrl: dbUrl(LEGACY),
  targetUrl: dbUrl(TARGET),
  dryRun,
  legacyTz: "Europe/Istanbul",
  emptyCheck: true,
});

const ids = (items: Finding[], key: string) => items.map((f) => f[key]);

beforeAll(async () => {
  await createLegacyDb(LEGACY);
  await withClient(LEGACY, seedLegacy);
  await createTargetDb(TARGET);
  await createTargetDb(BARE, false);
  before = await checksum(LEGACY);
  dry = await runMigration(opts(true));
  real = await runMigration(opts(false));
}, 180_000);

afterAll(async () => {
  await dropDb(LEGACY);
  await dropDb(TARGET);
  await dropDb(BARE);
}, 180_000);

describe("eski veritabanı oturumu", () => {
  it("salt-okunurdur: yazma 25006 ile reddedilir", async () => {
    const source = await openLegacy(dbUrl(LEGACY));
    try {
      const ro = await source.client.query<{ transaction_read_only: string }>("SHOW transaction_read_only");
      expect(ro.rows[0]?.transaction_read_only).toBe("on");
      await expect(source.client.query("DELETE FROM public.users")).rejects.toMatchObject({ code: "25006" });
    } finally {
      await source.close();
    }
  });

  it("taşımalar (dry-run + gerçek) eski veriyi değiştirmez", async () => {
    expect(await checksum(LEGACY)).toEqual(before);
  });
});

describe("ön koşullar", () => {
  it("migrate edilmemiş hedefte çalışmaz", async () => {
    const report = await runMigration({ ...opts(false), targetUrl: dbUrl(BARE) });
    expect(report.outcome).toBe("failed");
    expect(report.error).toMatch(/migrate edilmemiş/);
    expect(await totalRows(BARE)).toBe(0);
  });

  it("dolu hedefte ikinci çalıştırma reddedilir", async () => {
    const report = await runMigration(opts(false));
    expect(report.outcome).toBe("failed");
    expect(report.error).toMatch(/Hedef boş değil/);
  });
});

describe("--dry-run", () => {
  it("her şeyi çalıştırır, raporu üretir ve geri alır", () => {
    expect(dry.error).toBeNull();
    expect(dry.outcome).toBe("rolled-back");
    expect(dry.verification.every((v) => v.ok)).toBe(true);
    expect(dry.targetCounts.reservations).toBe(9);
    expect(dry.categories.conflictingReservations).toHaveLength(2);
  });

  it("gerçek çalıştırmayla aynı raporu verir", () => {
    expect(dry.categories).toEqual(real.categories);
    expect(dry.targetCounts).toEqual(real.targetCounts);
  });
});

describe("rapor kategorileri", () => {
  it("gerçek çalıştırma doğrulamayı geçip işler", () => {
    expect(real.error).toBeNull();
    expect(real.outcome).toBe("committed");
    expect(real.verification.filter((v) => !v.ok)).toEqual([]);
  });

  it("yetim masa referansları ve yer tutucu masalar", () => {
    const c = real.categories;
    const reservationOrphans = c.orphanTableReferences.filter((f) => f.table === "reservations");
    expect(ids(reservationOrphans, "id").sort()).toEqual([R.r5, R.r7, R.r8].sort());
    expect(c.orphanTableReferences.map((f) => f.legacyRef)).toEqual(expect.arrayContaining(["ghost-table", "ghost-x"]));
    expect(c.placeholderTables.map((f) => [f.eventId, f.legacyRef, f.label])).toEqual(
      expect.arrayContaining([
        [E.e1, "ghost-7", "Eski ghost-7"],
        [E.e3, "X9", "Eski X9"],
      ]),
    );
    expect(c.tablesResolvedByLabel.map((f) => f.reservationId)).toEqual([R.r9]);
  });

  it("çakışan rezervasyonlar: en eskisi aktif kalır", () => {
    const pairs = real.categories.conflictingReservations.map((f) => [f.keptReservationId, f.cancelledReservationIds]);
    expect(pairs).toEqual(expect.arrayContaining([[R.r1, [R.r2]], [R.r7, [R.r8]]]));
  });

  it("eşleşmeyen personel, harf büyüklüğü, organizatörsüz etkinlik", () => {
    const c = real.categories;
    expect(c.unmatchedStaff.map((f) => f.userId)).toEqual([IDS.users.reviewed]);
    expect(c.unmatchedStaff[0]?.referencedBy).toEqual(expect.arrayContaining(["staff_performance_reviews", "staff_assignments", "teams.memberIds"]));
    expect(c.caseOnlyUsernames.map((f) => f.usernames)).toEqual([["Ayse", "ayse"]]);
    expect(c.eventsWithoutOrganizer).toEqual([expect.objectContaining({ eventId: E.e2, assignedOrganizerId: IDS.users.admin })]);
    expect(c.userStaffLinks).toEqual([expect.objectContaining({ userId: IDS.users.linked, staffId: IDS.staff.s2, matchedBy: "email" })]);
    expect(c.unresolvedStaffReferences.map((f) => f.ref)).toContain("bogus");
  });

  it("müşteri birleştirme, misafirden müşteri, yer tutucu müşteri", () => {
    const c = real.categories;
    expect(c.customerMerges).toEqual([{ survivorId: IDS.customers.c1, mergedIds: [IDS.customers.c2], matchedBy: ["phone"] }]);
    expect(c.customersFromGuest.map((f) => [f.reservationId, f.action])).toEqual(
      expect.arrayContaining([
        [R.r3, "created"],
        [R.r6, "matched"],
      ]),
    );
    expect(c.placeholderCustomers.map((f) => f.reservationId)).toEqual([R.r4]);
    expect(c.unnormalizableContacts).toEqual([expect.objectContaining({ id: IDS.customers.c4, field: "phone" })]);
  });

  it("diğer çakışmalar ve düzeltmeler", () => {
    const c = real.categories;
    expect(c.duplicateLabels).toEqual([expect.objectContaining({ eventId: E.e2, legacyId: "T2" })]);
    expect(c.duplicateShiftNames).toEqual([expect.objectContaining({ shiftId: IDS.shifts.ws2, to: "Akşam (2)" })]);
    expect(c.tableGroupConflicts).toEqual([expect.objectContaining({ keptGroupId: IDS.groups.tg1, droppedFrom: `table_groups:${IDS.groups.tg2}` })]);
    expect(c.assignmentConflicts.map((f) => [f.id, f.action]).sort()).toEqual(
      [[IDS.assignments.spa1, "atlandı"], [IDS.assignments.sa2, "atlandı"]].sort(),
    );
    expect(c.userIdentityFixes.map((f) => [f.userId, f.field])).toEqual(
      expect.arrayContaining([[IDS.users.blank, "username"], [IDS.users.blank, "email"]]),
    );
    expect(c.invalidValues.map((f) => f.field)).toEqual(expect.arrayContaining(["guestCount", "eventEndDate", "shiftStart", "categoryScores.communication"]));
    expect(c.skippedRows.map((f) => f.id)).toEqual(expect.arrayContaining([IDS.invitations.orphan]));
    expect(c.catalogEntriesCreated.map((f) => f.name)).toEqual(expect.arrayContaining(["Servis", "Komi"]));
  });

  it("şema boşlukları dolu satırlarla listelenir", () => {
    const gap = (legacy: string) => real.schemaGaps.find((g) => g.legacy === legacy)?.rows;
    expect(gap("staff.age")).toBe(1);
    expect(gap("system_settings.smtpPassword")).toBe(1);
    expect(gap("staff_performance_logs.*")).toBe(1);
    expect(gap("events.venueLayout.tablePlans")).toBe(1);
    expect(gap("events.venueLayout.groupLines")).toBe(1);
    expect(gap("events.venueLayout.(placedTables|tables)[].isLocked")).toBe(3);
    expect(gap("events.venueLayout.stageElements[].isLocked")).toBe(1);
  });

  it("rapor ve konsol özeti telefon/e-posta içermez", () => {
    const outputs = [JSON.stringify(real), renderText(real), renderSummary(real)];
    for (const text of outputs) {
      expect(text).not.toMatch(/example\.test/i);
      expect(text).not.toMatch(/532\s?111|533\s?222|0555/);
    }
    expect(renderSummary(real)).not.toMatch(/Ayse|Müşteri|Misafir/);
  });
});

describe("hedef durum", () => {
  it("eski bcrypt parolası Better Auth kimlik hesabıyla doğrulanır", async () => {
    await withClient(TARGET, async (c) => {
      const res = await c.query<{ password: string; provider_id: string; account_id: string; username: string; email: string }>(
        `SELECT a.password, a.provider_id, a.account_id, u.username, u.email FROM accounts a JOIN users u ON u.id = a.user_id WHERE u.id = $1`,
        [IDS.users.admin],
      );
      const row = res.rows[0];
      expect(row).toMatchObject({ provider_id: "credential", account_id: IDS.users.admin, username: "admin", email: "admin@example.test" });
      expect(await bcrypt.compare(LEGACY_PASSWORD, row?.password ?? "")).toBe(true);
      const blank = await c.query<{ username: string; email: string; role: string }>("SELECT username, email, role FROM users WHERE id = $1", [IDS.users.blank]);
      expect(blank.rows[0]).toEqual({ username: "kullanici-00000000", email: `eski-${IDS.users.blank}@eventflow.invalid`, role: "controller" });
    });
  });

  it("eski yerel saat (Europe/Istanbul) timestamptz'ye doğru çevrilir", async () => {
    await withClient(TARGET, async (c) => {
      const ev = await c.query<{ starts_at: Date; ends_at: Date | null }>("SELECT starts_at, ends_at FROM events WHERE id = $1", [E.e1]);
      expect(ev.rows[0]?.starts_at.toISOString()).toBe("2025-06-01T18:00:00.000Z");
      expect(ev.rows[0]?.ends_at?.toISOString()).toBe("2025-06-01T23:00:00.000Z");
      const r3 = await c.query<{ checked_in_at: Date }>("SELECT checked_in_at FROM reservations WHERE id = $1", [R.r3]);
      expect(r3.rows[0]?.checked_in_at.toISOString()).toBe("2025-06-01T18:30:00.000Z");
      const e2 = await c.query<{ organizer_id: string; ends_at: Date | null }>("SELECT organizer_id, ends_at FROM events WHERE id = $1", [E.e2]);
      expect(e2.rows[0]).toEqual({ organizer_id: IDS.users.admin, ends_at: null });
    });
  });

  it("iki yerleşim biçimi de masa satırına, dekor decorSchema biçimine dönüşür", async () => {
    await withClient(TARGET, async (c) => {
      const tables = await c.query<{ event_id: string; label: string; capacity: number; is_loca: boolean; table_type_id: string | null; rotation: number }>(
        "SELECT event_id, label, capacity, is_loca, table_type_id, rotation FROM event_tables ORDER BY event_id, label",
      );
      const of = (eventId: string) => tables.rows.filter((t) => t.event_id === eventId);
      expect(of(E.e1).map((t) => t.label)).toEqual(["1", "2", "A1", "Eski ghost-7"]);
      expect(of(E.e1).find((t) => t.label === "1")?.table_type_id).toBe(IDS.tableType);
      expect(of(E.e1).find((t) => t.label === "A1")?.is_loca).toBe(true);
      expect(of(E.e1).find((t) => t.label === "Eski ghost-7")?.capacity).toBe(50);
      expect(of(E.e2).map((t) => [t.label, t.rotation])).toEqual([["1", 45], ["1 (2)", 0]]);
      expect(of(E.e3).map((t) => t.label)).toEqual(["Eski X9"]);
      const decor = await c.query<{ id: string; layout_decor: { width: number; height: number; elements: { kind: string }[] } | null }>(
        "SELECT id, layout_decor FROM events ORDER BY id",
      );
      const d = (eventId: string) => decor.rows.find((r) => r.id === eventId)?.layout_decor;
      expect(d(E.e1)).toMatchObject({ width: 1600, height: 900, elements: [{ kind: "stage", label: "Sahne", color: "#ff0000" }] });
      expect(d(E.e2)?.elements.map((e) => e.kind).sort()).toEqual(["stage", "wall"]);
      expect(d(E.e3)).toBeNull();
    });
  });

  it("rezervasyonlar: masa, müşteri, iptal notu ve QR", async () => {
    await withClient(TARGET, async (c) => {
      const res = await c.query<{ id: string; status: string; customer_id: string; guest_count: number; qr_token: string; legacy_qr_hash: string }>(
        "SELECT id, status, customer_id, guest_count, qr_token, legacy_qr_hash FROM reservations",
      );
      const by = new Map(res.rows.map((r) => [r.id, r]));
      expect(by.get(R.r1)?.status).toBe("confirmed");
      expect(by.get(R.r2)).toMatchObject({ status: "cancelled", customer_id: IDS.customers.c1 });
      expect(by.get(R.r8)?.status).toBe("cancelled");
      expect(by.get(R.r6)?.customer_id).toBe(IDS.customers.c1);
      expect(by.get(R.r5)?.guest_count).toBe(50);
      expect(by.get(R.r1)?.legacy_qr_hash).toBe("qr-01");
      for (const r of res.rows) expect(verifyQrToken(r.qr_token)).toEqual({ reservationId: r.id });
      const note = await c.query<{ content: string }>("SELECT content FROM guest_notes WHERE reservation_id = $1", [R.r2]);
      expect(note.rows[0]?.content).toMatch(/"pending"[^]*"cancelled"/);
      const merged = await c.query<{ phone_normalized: string; tags: string[] }>(
        "SELECT c.phone_normalized, array_agg(t.tag ORDER BY t.tag) AS tags FROM customers c JOIN customer_tags t ON t.customer_id = c.id WHERE c.id = $1 GROUP BY c.id",
        [IDS.customers.c1],
      );
      expect(merged.rows[0]).toEqual({ phone_normalized: "+905321112233", tags: ["sadik", "vip"] });
      const gone = await c.query("SELECT 1 FROM customers WHERE id = $1", [IDS.customers.c2]);
      expect(gone.rowCount).toBe(0);
      const n1 = await c.query<{ customer_id: string }>("SELECT customer_id FROM guest_notes WHERE id = $1", [IDS.notes.n1]);
      expect(n1.rows[0]?.customer_id).toBe(IDS.customers.c1);
    });
  });

  it("personel, ekipler, gruplar ve atamalar", async () => {
    await withClient(TARGET, async (c) => {
      const s1 = await c.query<{ status: string; dept: string; pos: string }>(
        "SELECT s.status, d.name AS dept, p.name AS pos FROM staff s JOIN departments d ON d.id = s.department_id JOIN positions p ON p.id = s.position_id WHERE s.id = $1",
        [IDS.staff.s1],
      );
      expect(s1.rows[0]).toEqual({ status: "inactive", dept: "Servis", pos: "Garson" });
      const link = await c.query<{ staff_id: string | null }>("SELECT staff_id FROM users WHERE id = $1", [IDS.users.linked]);
      expect(link.rows[0]?.staff_id).toBe(IDS.staff.s2);
      const created = await c.query<{ staff_id: string }>("SELECT staff_id FROM users WHERE id = $1", [IDS.users.reviewed]);
      const createdStaff = created.rows[0]?.staff_id ?? "";
      expect(real.categories.unmatchedStaff[0]?.createdStaffId).toBe(createdStaff);

      const leader = await c.query<{ is_leader: boolean; role: string; shift_start: string }>(
        "SELECT is_leader, role, shift_start FROM team_members WHERE team_id = $1 AND staff_id = $2",
        [IDS.teams.service, IDS.staff.s2],
      );
      expect(leader.rows[0]).toEqual({ is_leader: true, role: "captain", shift_start: "18:00:00" });
      const globalMembers = await c.query<{ staff_id: string }>("SELECT staff_id FROM team_members WHERE team_id = $1 ORDER BY staff_id", [IDS.teams.global]);
      expect(globalMembers.rows.map((r) => r.staff_id).sort()).toEqual([IDS.staff.s1, createdStaff].sort());

      const groups = await c.query<{ table_group_id: string; label: string }>(
        "SELECT g.table_group_id, t.label FROM table_group_tables g JOIN event_tables t ON t.id = g.table_id ORDER BY t.label",
      );
      expect(groups.rows.find((g) => g.label === "1")?.table_group_id).toBe(IDS.groups.tg1);
      expect(groups.rows.find((g) => g.label === "2")?.table_group_id).not.toBe(IDS.groups.tg2);

      const a = await c.query<{ id: string; assignment_type: string; staff_id: string; n: string }>(
        `SELECT a.id, a.assignment_type, a.staff_id, count(t.id)::text AS n FROM event_staff_assignments a
           LEFT JOIN assignment_tables t ON t.assignment_id = a.id GROUP BY a.id`,
      );
      const byId = new Map(a.rows.map((r) => [r.id, r]));
      expect(byId.get(IDS.assignments.a1)?.n).toBe("2");
      expect(byId.get(IDS.assignments.spa2)?.assignment_type).toBe("service_point");
      expect(byId.get(IDS.assignments.sa1)).toMatchObject({ staff_id: createdStaff, n: "1" });
      expect(byId.has(IDS.assignments.spa1)).toBe(false);

      const review = await c.query<{ staff_id: string; communication: number; strengths: string[] }>(
        "SELECT staff_id, communication, strengths FROM staff_performance_reviews WHERE id = $1",
        [IDS.review],
      );
      expect(review.rows[0]).toEqual({ staff_id: createdStaff, communication: 5, strengths: ["güler yüzlü"] });
      const perms = await c.query<{ can_create: boolean; can_edit: boolean }>("SELECT can_create, can_edit FROM user_permissions");
      expect(perms.rows).toEqual([{ can_create: true, can_edit: true }]);
      const settings = await c.query<{ smtp_password_encrypted: string | null }>("SELECT smtp_password_encrypted FROM system_settings");
      expect(settings.rows).toEqual([{ smtp_password_encrypted: null }]);
    });
  });
});
