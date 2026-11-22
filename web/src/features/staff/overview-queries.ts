import { asc, count, eq, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { departments, staff } from "@/db/schema";
import { authorize, type PolicyActor } from "@/features/auth/policy";

export type StaffStats = { total: number; active: number; inactive: number; terminated: number };

/** Personel sayfası istatistik kartları: durum bazında sayılar (süzgeçten bağımsız). */
export async function getStaffStats(db: Db | Tx, actor: PolicyActor): Promise<StaffStats> {
  authorize(actor, "staff", "view");
  const rows = await db.select({ status: staff.status, total: count() }).from(staff).groupBy(staff.status);
  const by = (status: "active" | "inactive" | "terminated") => rows.find((r) => r.status === status)?.total ?? 0;
  const active = by("active");
  const inactive = by("inactive");
  const terminated = by("terminated");
  return { total: active + inactive + terminated, active, inactive, terminated };
}

export type DepartmentCard = {
  id: string | null;
  name: string;
  color: string | null;
  description: string | null;
  activeCount: number;
  totalCount: number;
};

/** Bölüm kartları: etkin bölümler ve her birinin personel sayısı; bölümsüzler ayrı bir kart olur. */
export async function listDepartmentCards(db: Db | Tx, actor: PolicyActor): Promise<DepartmentCard[]> {
  authorize(actor, "staff", "view");
  const rows = await db
    .select({
      id: departments.id,
      name: departments.name,
      color: departments.color,
      description: departments.description,
      totalCount: count(staff.id),
      activeCount: sql<number>`count(${staff.id}) filter (where ${staff.status} = 'active')`.mapWith(Number),
    })
    .from(departments)
    .leftJoin(staff, eq(staff.departmentId, departments.id))
    .where(eq(departments.isActive, true))
    .groupBy(departments.id)
    .orderBy(asc(departments.sortOrder), asc(departments.name));
  const [unassigned] = await db
    .select({
      totalCount: count(),
      activeCount: sql<number>`count(*) filter (where ${staff.status} = 'active')`.mapWith(Number),
    })
    .from(staff)
    .where(sql`${staff.departmentId} is null`);
  const cards: DepartmentCard[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    description: r.description,
    activeCount: r.activeCount,
    totalCount: r.totalCount,
  }));
  if (unassigned && unassigned.totalCount > 0) {
    cards.push({
      id: null,
      name: "Bölümsüz",
      color: null,
      description: null,
      activeCount: unassigned.activeCount,
      totalCount: unassigned.totalCount,
    });
  }
  return cards;
}
