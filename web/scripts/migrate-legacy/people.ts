import * as schema from "@/db/schema";
import { ROLES, type Role } from "@/features/auth/roles";
import { isValidUsername } from "@/features/auth/username";
import { normalizeEmail, normalizePhone } from "@/features/customers/normalize";
import { type CatalogIndex, timestamps } from "./catalogs";
import { type Ctx, isRecord } from "./context";
import { asUuid, byCreatedThenId, type Row, stableId } from "./values";

/**
 * Kullanıcılar (+ Better Auth `accounts` kimlik bilgisi satırı), personel ve izinler.
 *
 * Parola: eski bcrypt özeti `accounts.password` alanına olduğu gibi yazılır; satır biçimi
 * `scripts/create-admin.ts` ile aynıdır (`providerId = "credential"`, `accountId = userId`).
 * Uygulama `bcrypt.compare` ile doğruladığı için eski parolalar çalışmaya devam eder.
 *
 * Kullanıcı ↔ personel: eski şemada bağlantı sütunu yoktur. Eşleme sırası normalize e-posta,
 * normalize telefon, (her iki tarafta tekil olan) ad soyad. Personel olarak referans alınan
 * (değerlendirme, eski atama, ekip üyeliği…) ama eşleşmeyen kullanıcılar için personel kaydı oluşturulur.
 */

/** create-admin.ts ile aynı yer tutucu e-posta alanı (o modül auth/db yüklediği için içe aktarılmaz). */
export const PLACEHOLDER_EMAIL_DOMAIN = "eventflow.invalid";
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const PERMISSION_MODULES = new Set<string>(schema.permissionModule.enumValues);

function isRole(value: string | null): value is Role {
  return value !== null && (ROLES as readonly string[]).includes(value);
}

const nameKey = (s: string | null) => (s ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");

/** Eski verinin "personel" olarak kullanıcı kimliği gösterdiği yerler (tablo adıyla). */
function staffReferences(ctx: Ctx): Map<string, Set<string>> {
  const L = ctx.legacy;
  const refs = new Map<string, Set<string>>();
  const add = (value: unknown, source: string) => {
    const id = asUuid(typeof value === "string" ? value : null);
    if (id === null) return;
    const set = refs.get(id) ?? new Set<string>();
    set.add(source);
    refs.set(id, set);
  };
  L.staff_assignments.forEach((r) => add(r.str("staffId"), "staff_assignments"));
  L.staff_performance_reviews.forEach((r) => add(r.str("staffId"), "staff_performance_reviews"));
  L.service_point_staff_assignments.forEach((r) => add(r.str("staffId"), "service_point_staff_assignments"));
  L.table_groups.forEach((r) => add(r.str("assignedSupervisorId"), "table_groups.assignedSupervisorId"));
  L.teams.forEach((r) => {
    add(r.str("leaderId"), "teams.leaderId");
    r.strings("memberIds").forEach((m) => add(m, "teams.memberIds"));
  });
  L.service_teams.forEach((r) => {
    add(r.str("leaderId"), "service_teams.leaderId");
    const members = r.json("members");
    if (Array.isArray(members)) members.forEach((m) => isRecord(m) && add(m.id, "service_teams.members"));
    const leaders = r.json("leaders");
    if (Array.isArray(leaders)) leaders.forEach((m) => isRecord(m) && add(m.staffId, "service_teams.leaders"));
  });
  return refs;
}

type Catalogs = { departments: CatalogIndex; positions: CatalogIndex; workLocations: CatalogIndex };

function staffStatus(r: Row): "active" | "inactive" | "terminated" {
  const status = r.str("status");
  const isActive = r.bool("isActive", true);
  if (status === "terminated") return "terminated";
  if (status === null) return isActive ? "active" : "inactive";
  if (status === "active" && !isActive) return "inactive";
  return status === "inactive" ? "inactive" : "active";
}

function fixUsernames(ctx: Ctx, users: Row[]): Map<string, string> {
  const out = new Map<string, string>();
  const taken = new Set(users.map((u) => u.str("username")).filter((u): u is string => u !== null && isValidUsername(u)));
  for (const u of users) {
    const raw = u.str("username");
    if (raw !== null && isValidUsername(raw)) {
      out.set(u.id, raw);
      continue;
    }
    const trimmed = raw?.trim() ?? "";
    let next = trimmed !== "" && isValidUsername(trimmed) && !taken.has(trimmed) ? trimmed : `kullanici-${u.id.slice(0, 8)}`;
    for (let n = 2; taken.has(next); n += 1) next = `kullanici-${u.id.slice(0, 8)}-${n}`;
    taken.add(next);
    out.set(u.id, next);
    ctx.add("userIdentityFixes", { userId: u.id, field: "username", reason: raw === null ? "boş" : "geçersiz", newUsername: next });
  }
  const groups = new Map<string, Row[]>();
  for (const u of users) {
    const key = (out.get(u.id) ?? "").toLocaleLowerCase("tr");
    groups.set(key, [...(groups.get(key) ?? []), u]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    ctx.add("caseOnlyUsernames", {
      usernames: group.map((u) => out.get(u.id) ?? ""),
      userIds: group.map((u) => u.id),
      action: "ikisi de korundu (giriş büyük/küçük harf duyarlı)",
    });
  }
  return out;
}

function fixEmails(ctx: Ctx, users: Row[]): Map<string, string> {
  const out = new Map<string, string>();
  const seen = new Set<string>();
  for (const u of [...users].sort(byCreatedThenId)) {
    const raw = u.trimmed("email");
    const value = raw?.toLowerCase() ?? null;
    if (value !== null && !seen.has(value)) {
      seen.add(value);
      out.set(u.id, value);
      continue;
    }
    const placeholder = `eski-${u.id}@${PLACEHOLDER_EMAIL_DOMAIN}`;
    out.set(u.id, placeholder);
    ctx.add("userIdentityFixes", { userId: u.id, field: "email", reason: value === null ? "boş" : "küçük harfe çevrilince çakışıyor", action: "yer tutucu e-posta" });
  }
  return out;
}

export async function migratePeople(ctx: Ctx, catalogs: Catalogs): Promise<void> {
  const L = ctx.legacy;
  const users = [...L.users].sort(byCreatedThenId);
  users.forEach((u) => ctx.userIds.add(u.id));
  const usernames = fixUsernames(ctx, users);
  const emails = fixEmails(ctx, users);

  // Personel kayıtları (kataloglar serbest metinden bulunur ya da oluşturulur).
  const staffRows = L.staff.map((r) => {
    ctx.staffIds.add(r.id);
    return {
      id: r.id,
      sicilNo: r.text("sicilNo"),
      fullName: r.text("fullName"),
      email: r.str("email"),
      phone: r.str("phone"),
      photoPath: r.str("avatar"),
      departmentId: catalogs.departments.idFor(r.str("department"), ctx, r.id),
      positionId: catalogs.positions.idFor(r.str("position"), ctx, r.id),
      workLocationId: catalogs.workLocations.idFor(r.str("workLocation"), ctx, r.id),
      mentor: r.str("mentor"),
      color: r.str("color"),
      gender: r.str("gender") === "male" || r.str("gender") === "female" ? (r.str("gender") as "male" | "female") : null,
      birthDate: r.str("birthDate"),
      bloodType: r.str("bloodType"),
      shoeSize: r.int("shoeSize"),
      sockSize: r.str("sockSize"),
      hireDate: r.str("hireDate"),
      terminationDate: r.str("terminationDate"),
      terminationReason: r.str("terminationReason"),
      yearsAtCompany: r.int("yearsAtCompany"),
      status: staffStatus(r),
      ...timestamps(r),
    };
  });

  linkUsersToStaff(ctx, users);

  const refs = staffReferences(ctx);
  const sicils = new Set(staffRows.map((s) => s.sicilNo));
  for (const u of users) {
    const sources = refs.get(u.id);
    if (!sources || ctx.staffIds.has(u.id) || ctx.userToStaff.has(u.id)) continue;
    const staffId = stableId("staff-from-user", u.id);
    let sicilNo = `ESKI-K-${u.id.slice(0, 8)}`;
    if (sicils.has(sicilNo)) sicilNo = `ESKI-K-${u.id}`;
    sicils.add(sicilNo);
    staffRows.push({
      id: staffId,
      sicilNo,
      fullName: u.text("fullName", usernames.get(u.id) ?? u.id),
      email: u.str("email"),
      phone: u.str("phone"),
      photoPath: u.str("avatar"),
      departmentId: null,
      positionId: catalogs.positions.idFor(u.str("position"), ctx, u.id),
      workLocationId: null,
      mentor: null,
      color: u.str("color"),
      gender: null,
      birthDate: null,
      bloodType: null,
      shoeSize: null,
      sockSize: null,
      hireDate: null,
      terminationDate: null,
      terminationReason: null,
      yearsAtCompany: null,
      status: u.bool("isActive", true) ? "active" : "inactive",
      ...timestamps(u),
    });
    ctx.staffIds.add(staffId);
    ctx.userToStaff.set(u.id, staffId);
    ctx.add("unmatchedStaff", { userId: u.id, createdStaffId: staffId, sicilNo, referencedBy: [...sources].sort() });
  }

  await catalogs.departments.flush(ctx, schema.departments);
  await catalogs.positions.flush(ctx, schema.positions);
  await catalogs.workLocations.flush(ctx, schema.workLocations);
  await ctx.w.insert(schema.staff, staffRows);

  await ctx.w.insert(
    schema.users,
    users.map((u) => {
      const role = u.str("role");
      if (!isRole(role)) ctx.add("invalidValues", { table: "users", id: u.id, field: "role", from: role, to: "staff" });
      return {
        id: u.id,
        name: u.trimmed("fullName") ?? usernames.get(u.id) ?? u.id,
        email: emails.get(u.id) ?? `eski-${u.id}@${PLACEHOLDER_EMAIL_DOMAIN}`,
        emailVerified: true,
        image: u.str("avatar"),
        username: usernames.get(u.id) ?? `kullanici-${u.id.slice(0, 8)}`,
        role: isRole(role) ? role : "staff",
        isActive: u.bool("isActive", true),
        staffId: ctx.userToStaff.get(u.id) ?? null,
        color: u.str("color"),
        phone: u.str("phone"),
        position: u.str("position"),
        ...timestamps(u),
      };
    }),
  );
  await ctx.w.insert(
    schema.accounts,
    users.map((u) => {
      const hash = u.text("password");
      if (!BCRYPT_RE.test(hash)) ctx.add("nonBcryptPasswords", { userId: u.id, prefix: hash.slice(0, 4) });
      return {
        id: stableId("account", u.id),
        accountId: u.id,
        providerId: "credential",
        userId: u.id,
        password: hash,
        ...timestamps(u),
      };
    }),
  );
  await migratePermissions(ctx);
}

function linkUsersToStaff(ctx: Ctx, users: Row[]): void {
  const staff = ctx.legacy.staff;
  const index = (key: (r: Row) => string | null) => {
    const map = new Map<string, Row[]>();
    for (const s of staff) {
      const k = key(s);
      if (k) map.set(k, [...(map.get(k) ?? []), s]);
    }
    return map;
  };
  const email = (r: Row) => (r.str("email") ? normalizeEmail(r.text("email")) : null);
  const phone = (r: Row) => (r.str("phone") ? normalizePhone(r.text("phone")) : null);
  const name = (r: Row) => nameKey(r.str("fullName")) || null;
  const byEmail = index(email);
  const byPhone = index(phone);
  const byName = index(name);
  const userNameCount = new Map<string, number>();
  users.forEach((u) => {
    const k = name(u);
    if (k) userNameCount.set(k, (userNameCount.get(k) ?? 0) + 1);
  });
  const linked = new Set<string>();
  const pick = (candidates: Row[] | undefined, requireUnique: boolean) => {
    const free = (candidates ?? []).filter((s) => !linked.has(s.id));
    if (free.length === 0 || (requireUnique && (candidates ?? []).length !== 1)) return null;
    return free[0] ?? null;
  };
  for (const u of users) {
    if (ctx.staffIds.has(u.id)) continue;
    const attempts: Array<[string, Row | null]> = [
      ["email", email(u) ? pick(byEmail.get(email(u) ?? ""), false) : null],
      ["phone", phone(u) ? pick(byPhone.get(phone(u) ?? ""), false) : null],
      ["fullName", name(u) && userNameCount.get(name(u) ?? "") === 1 ? pick(byName.get(name(u) ?? ""), true) : null],
    ];
    const hit = attempts.find(([, s]) => s !== null);
    if (!hit || !hit[1]) continue;
    linked.add(hit[1].id);
    ctx.userToStaff.set(u.id, hit[1].id);
    ctx.add("userStaffLinks", { userId: u.id, staffId: hit[1].id, matchedBy: hit[0] });
  }
}

async function migratePermissions(ctx: Ctx): Promise<void> {
  const merged = new Map<string, { id: string; userId: string; module: string; v: boolean; c: boolean; e: boolean; d: boolean; row: Row }>();
  for (const r of [...ctx.legacy.user_permissions].sort(byCreatedThenId)) {
    const userId = ctx.resolveUser(r.str("userId"));
    const moduleName = r.str("module");
    if (userId === null || moduleName === null || !PERMISSION_MODULES.has(moduleName)) {
      ctx.add("skippedRows", { table: "user_permissions", id: r.id, reason: userId === null ? "kullanıcı yok" : "modül geçersiz" });
      continue;
    }
    const key = `${userId}:${moduleName}`;
    const prev = merged.get(key);
    const flags = { v: r.bool("canView", true), c: r.bool("canCreate", false), e: r.bool("canEdit", false), d: r.bool("canDelete", false) };
    if (prev) {
      Object.assign(prev, { v: prev.v || flags.v, c: prev.c || flags.c, e: prev.e || flags.e, d: prev.d || flags.d });
      ctx.add("information", { table: "user_permissions", id: r.id, detail: `aynı (kullanıcı, modül) ${prev.id} ile birleştirildi (bayraklar VEYA)` });
    } else merged.set(key, { id: r.id, userId, module: moduleName, ...flags, row: r });
  }
  await ctx.w.insert(
    schema.userPermissions,
    [...merged.values()].map((p) => ({
      id: p.id,
      userId: p.userId,
      module: p.module as (typeof schema.permissionModule.enumValues)[number],
      canView: p.v,
      canCreate: p.c,
      canEdit: p.e,
      canDelete: p.d,
      ...timestamps(p.row),
    })),
  );
}

