import bcrypt from "bcryptjs";
import type pg from "pg";

/**
 * SENTETİK eski veri (gerçek kişisel veri içermez). Her senaryo bir rapor kategorisini ya da
 * hedef durum kuralını tetikler; kimlikler okunabilir sabit uuid'lerdir.
 */

const id = (group: number, n: number) => `00000000-0000-4000-8${String(group).padStart(3, "0")}-${String(n).padStart(12, "0")}`;

export const LEGACY_PASSWORD = "Eski-Parola-12345";

export const IDS = {
  users: { admin: id(1, 1), organizer: id(1, 2), caseUpper: id(1, 3), caseLower: id(1, 4), linked: id(1, 5), reviewed: id(1, 6), blank: id(1, 7) },
  staff: { s1: id(2, 1), s2: id(2, 2) },
  department: id(3, 1),
  position: id(3, 2),
  workLocation: id(3, 3),
  tableType: id(3, 4),
  events: { e1: id(4, 1), e2: id(4, 2), e3: id(4, 3) },
  venueTemplate: id(4, 9),
  customers: { c1: id(5, 1), c2: id(5, 2), c3: id(5, 3), c4: id(5, 4) },
  reservations: { r1: id(6, 1), r2: id(6, 2), r3: id(6, 3), r4: id(6, 4), r5: id(6, 5), r6: id(6, 6), r7: id(6, 7), r8: id(6, 8), r9: id(6, 9) },
  teams: { global: id(7, 1), service: id(7, 2) },
  groups: { tg1: id(7, 11), tg2: id(7, 12) },
  shifts: { ws1: id(8, 1), ws2: id(8, 2), ws3: id(8, 3) },
  servicePoint: id(8, 9),
  assignments: { a1: id(9, 1), a2: id(9, 2), spa1: id(9, 3), spa2: id(9, 4), sa1: id(9, 5), sa2: id(9, 6) },
  extraStaff: id(9, 9),
  review: id(10, 1),
  notification: id(10, 2),
  invitationTemplate: id(10, 3),
  invitations: { ok: id(10, 4), orphan: id(10, 5) },
  notes: { n1: id(10, 6), n2: id(10, 7) },
} as const;

async function ins(client: pg.Client, table: string, row: Record<string, unknown>): Promise<void> {
  const cols = Object.keys(row);
  const values = cols.map((c) => {
    const v = row[c];
    return v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v;
  });
  const sql = `INSERT INTO public."${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`;
  await client.query(sql, values);
}

const json = (v: unknown) => JSON.stringify(v);

export async function seedLegacy(client: pg.Client): Promise<void> {
  const U = IDS.users;
  const hash = bcrypt.hashSync(LEGACY_PASSWORD, 4);
  const user = (uid: string, username: string | null, role: string, email: string | null, createdAt: string, extra: Record<string, unknown> = {}) =>
    ins(client, "users", { id: uid, username, role, email, password: hash, fullName: `Kullanıcı ${username ?? "adsız"}`, createdAt, updatedAt: createdAt, ...extra });
  await user(U.admin, "admin", "admin", "Admin@Example.test", "2024-01-01 09:00:00");
  await user(U.organizer, "organizator", "organizer", "org@example.test", "2024-01-02 09:00:00", { phone: "0555 000 00 01", position: "Koordinatör" });
  await user(U.caseUpper, "Ayse", "staff", "ayse1@example.test", "2024-01-03 09:00:00");
  await user(U.caseLower, "ayse", "staff", "ayse2@example.test", "2024-01-04 09:00:00");
  await user(U.linked, "garson1", "staff", "garson1@example.test", "2024-01-05 09:00:00", { fullName: "Garson Bir" });
  await user(U.reviewed, "garson2", "staff", "garson2@example.test", "2024-01-06 09:00:00", { fullName: "Garson İki", avatar: "/u/a.png" });
  await user(U.blank, null, "controller", null, "2024-01-07 09:00:00");

  await ins(client, "departments", { id: IDS.department, name: "Mutfak" });
  await ins(client, "positions", { id: IDS.position, name: "Garson" });
  await ins(client, "work_locations", { id: IDS.workLocation, name: "Ana Salon", sortOrder: null, isActive: null });
  await ins(client, "department_positions", { departmentId: IDS.department, positionId: IDS.position });
  await ins(client, "table_types", { id: IDS.tableType, name: "VIP", basePrice: "1500.50", capacity: 10 });
  await ins(client, "staff_roles", { key: "waiter", label: "Garson" });
  await ins(client, "staff_colors", { name: "Kırmızı", color: "#ff0000" });
  await ins(client, "system_settings", { companyName: "Sentetik", smtpPassword: "sentetik-parola" });

  await ins(client, "staff", {
    id: IDS.staff.s1, sicilNo: "S001", fullName: "Personel Bir", position: "garson", department: "Servis", age: 30, isActive: false, status: null,
    birthDate: "1990-05-17", hireDate: "2020-01-01",
  });
  await ins(client, "staff", { id: IDS.staff.s2, sicilNo: "S002", fullName: "Garson Bir", position: "Komi", email: "GARSON1@example.test" });

  await ins(client, "venue_templates", { id: IDS.venueTemplate, name: "Salon", layoutData: json({ placedTables: [] }), createdBy: U.admin });

  const E = IDS.events;
  await ins(client, "events", {
    id: E.e1, name: "Yaz Gecesi", eventDate: "2025-06-01 21:00:00", eventEndDate: "2025-06-02 02:00:00", organizerId: U.organizer, status: "published",
    venueLayout: json({
      placedTables: [
        { id: "t-1", tableNumber: 1, type: "VIP", capacity: 10, x: 100, y: 100, isLoca: false, isLocked: true },
        { id: "t-2", tableNumber: 2, type: "standard", capacity: 8, x: 200, y: 100, isLoca: false, isLocked: false },
        { id: "loca-1", tableNumber: 3, type: "loca", capacity: 6, x: 0, y: 300, isLoca: true, locaName: "A1", isLocked: false },
      ],
      stageElements: [{ id: "stage-1", type: "stage", x: 500, y: 0, width: 300, height: 100, label: "Sahne", isLocked: true, color: "#ff0000" }],
      dimensions: { width: 1600, height: 900 },
      tablePlans: [{ id: "p1", type: "VIP", capacity: 10, count: 2 }],
      groupLines: [{ id: "g1", orientation: "h", position: 3 }],
    }),
  });
  await ins(client, "events", {
    id: E.e2, name: "Yılbaşı", eventDate: "2025-12-31 22:00:00", eventEndDate: "2025-12-31 21:00:00", organizerId: null,
    venueLayout: json({
      tables: [
        { id: "T1", type: "standard", x: 10, y: 10, rotation: 45, capacity: 4, label: "1" },
        { id: "T2", type: "standard", x: 20, y: 20, rotation: 0, capacity: 4, label: "1" },
      ],
      walls: [{ id: "w1", points: [0, 0, 100, 0] }],
      stage: { x: 0, y: 0, width: 200, height: 50 },
      dimensions: { width: 1000, height: 700 },
    }),
  });
  await ins(client, "events", { id: E.e3, name: "Yerleşimsiz", eventDate: "2025-03-01 20:00:00", organizerId: U.admin });

  const C = IDS.customers;
  await ins(client, "customers", { id: C.c1, fullName: "Müşteri Bir", phone: "0532 111 22 33", tags: ["vip"], totalReservations: 2, createdAt: "2024-02-01 10:00:00" });
  await ins(client, "customers", { id: C.c2, fullName: "Müşteri Bir (kopya)", phone: "+905321112233", tags: ["vip", "sadik"], totalReservations: 1, createdAt: "2024-03-01 10:00:00" });
  await ins(client, "customers", { id: C.c3, fullName: "Müşteri Üç", email: "C3@Example.test", lastEventId: "not-a-uuid", createdAt: "2024-04-01 10:00:00" });
  await ins(client, "customers", { id: C.c4, fullName: "Müşteri Dört", phone: "123", createdAt: "2024-05-01 10:00:00" });

  const R = IDS.reservations;
  const res = (rid: string, eventId: string, tableId: string, customerId: string | null, status: string, createdAt: string, extra: Record<string, unknown> = {}) =>
    ins(client, "reservations", { id: rid, eventId, tableId, customerId, status, guestCount: 4, qrCodeHash: `qr-${rid.slice(-2)}`, createdAt, updatedAt: createdAt, ...extra });
  await res(R.r1, E.e1, "t-1", C.c1, "confirmed", "2025-05-01 10:00:00", { totalAmount: "2500.00" });
  await res(R.r2, E.e1, "t-1", C.c2, "pending", "2025-05-02 10:00:00");
  await res(R.r3, E.e1, "t-2", null, "checked_in", "2025-05-03 10:00:00", { guestName: "Misafir Bir", guestPhone: "0533 222 33 44", checkInTime: "2025-06-01 21:30:00" });
  await res(R.r4, E.e1, "loca-1", null, "cancelled", "2025-05-04 10:00:00", { guestName: "Sadece Ad" });
  await res(R.r5, E.e1, "ghost-7", C.c3, "confirmed", "2025-05-05 10:00:00", { guestCount: 60 });
  await res(R.r6, E.e2, "T2", null, "no_show", "2025-05-06 10:00:00", { guestPhone: "05321112233" });
  await res(R.r7, E.e3, "X9", C.c3, "confirmed", "2025-05-07 10:00:00");
  await res(R.r8, E.e3, "X9", C.c4, "pending", "2025-05-08 10:00:00");
  await res(R.r9, E.e1, "A1", C.c4, "pending", "2025-05-09 10:00:00");

  await ins(client, "guest_notes", { id: IDS.notes.n1, customerId: C.c2, eventId: E.e1, content: "Pencere kenarı", createdBy: U.admin });
  await ins(client, "guest_notes", { id: IDS.notes.n2, customerId: C.c3, content: "Not", createdBy: "unknown-user" });

  const S = IDS.shifts;
  await ins(client, "work_shifts", { id: S.ws1, name: "Akşam", startTime: "18:00", endTime: "02:00", createdAt: "2024-01-01 00:00:00" });
  await ins(client, "work_shifts", { id: S.ws2, name: "Akşam", startTime: "19:00", endTime: "03:00", createdAt: "2024-01-02 00:00:00" });
  await ins(client, "work_shifts", { id: S.ws3, name: "Akşam", startTime: "18:00", endTime: "02:00", eventId: E.e1 });
  await ins(client, "service_points", { id: IDS.servicePoint, eventId: E.e1, name: "Bar 1", requiredStaffCount: null, allowedRoles: null });

  const T = IDS.teams;
  await ins(client, "teams", { id: T.global, name: "Ekip A", leaderId: U.linked, memberIds: [IDS.staff.s1, U.reviewed] });
  await ins(client, "service_teams", {
    id: T.service, eventId: E.e1, name: "Servis Ekibi", leaderId: "bogus",
    members: json([{ id: IDS.staff.s1, fullName: "Personel Bir", email: "", color: "#000000" }]),
    leaders: json([{ staffId: IDS.staff.s2, staffName: "Garson Bir", role: "captain", shiftStart: "18:00", shiftEnd: "02:00" }]),
    tableIds: ["t-2", "t-1"],
  });
  await ins(client, "table_groups", {
    id: IDS.groups.tg1, eventId: E.e1, name: "Ön", tableIds: ["t-1", "ghost-table"], assignedTeamId: T.service, assignedSupervisorId: U.linked, sortOrder: 0,
  });
  await ins(client, "table_groups", { id: IDS.groups.tg2, eventId: E.e1, name: "Arka", tableIds: ["t-1"], sortOrder: 1 });

  const A = IDS.assignments;
  await ins(client, "event_staff_assignments", { id: A.a1, eventId: E.e1, staffId: IDS.staff.s1, tableIds: ["t-1", "t-2"], shiftStart: "18:00", createdAt: "2025-05-01 00:00:00" });
  await ins(client, "event_staff_assignments", { id: A.a2, eventId: E.e1, staffId: IDS.staff.s2, assignmentType: "special_task", shiftStart: "25:99", createdAt: "2025-05-01 00:00:01" });
  await ins(client, "service_point_staff_assignments", { id: A.spa1, eventId: E.e1, servicePointId: IDS.servicePoint, staffId: IDS.staff.s1, role: "barmen" });
  await ins(client, "service_point_staff_assignments", { id: A.spa2, eventId: E.e1, servicePointId: IDS.servicePoint, staffId: IDS.staff.s2, role: "barmen", shiftId: S.ws3 });
  await ins(client, "staff_assignments", { id: A.sa1, eventId: E.e1, staffId: U.reviewed, assignedTableIds: ["t-2", "ghost-x"] });
  await ins(client, "staff_assignments", { id: A.sa2, eventId: E.e1, staffId: U.linked, assignedTableIds: ["t-1"] });
  await ins(client, "event_extra_staff", {
    id: IDS.extraStaff, event_id: E.e1, full_name: "Geçici Personel", shift_start: "19:00", assigned_tables: json(["t-1"]), assigned_groups: json([IDS.groups.tg1, "nope"]),
  });

  await ins(client, "staff_performance_reviews", {
    id: IDS.review, staffId: U.reviewed, reviewerId: U.admin, eventId: E.e1, score: 80, rating: "good",
    categoryScores: json({ communication: 4.5, punctuality: 5, teamwork: 4, customerService: 3, technicalSkills: 4, initiative: 2, appearance: 5, stressManagement: 4 }),
    strengths: json(["güler yüzlü"]),
  });
  await ins(client, "staff_performance_logs", { staffId: U.reviewed, eventId: E.e1, actionType: "x" });
  await ins(client, "notifications", { id: IDS.notification, type: "event_created", title: "Yeni", message: "Etkinlik", eventId: E.e1, createdById: U.admin });
  await ins(client, "notification_reads", { notificationId: IDS.notification, userId: U.admin });
  await ins(client, "invitation_templates", { id: IDS.invitationTemplate, name: "Klasik", createdById: U.admin });
  await ins(client, "event_invitations", { id: IDS.invitations.ok, eventId: E.e1, templateId: IDS.invitationTemplate });
  await ins(client, "event_invitations", { id: IDS.invitations.orphan, eventId: "gone" });
  await ins(client, "organization_templates", { name: "Standart", createdById: U.admin, tags: ["a"] });

  // Şema dökümünde yok ama eski kodda migration'ı var: varsa taşınır (yinelenen modül birleştirilir).
  await client.query(`CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY, "userId" uuid NOT NULL, module text NOT NULL,
    "canView" boolean DEFAULT true, "canCreate" boolean DEFAULT false, "canEdit" boolean DEFAULT false, "canDelete" boolean DEFAULT false,
    "createdAt" timestamp DEFAULT now(), "updatedAt" timestamp DEFAULT now())`);
  await ins(client, "user_permissions", { userId: U.organizer, module: "events", canCreate: true, createdAt: "2024-01-01 00:00:00" });
  await ins(client, "user_permissions", { userId: U.organizer, module: "events", canEdit: true, createdAt: "2024-01-02 00:00:00" });
}
