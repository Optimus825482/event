import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/uploads/[...path]/route";
import { db } from "@/db/client";
import { eventInvitations, systemSettings } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { UPLOAD_ROOT } from "@/features/uploads/root";
import { managerActor, memberActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createEvent } from "../../helpers/factories";
import { loginAs } from "../realtime/helpers";

const ctx = (...segments: string[]) => ({ params: Promise.resolve({ path: segments }) });
const CATEGORIES = ["logo", "invitation", "avatar", "event"] as const;
const ids = {
  mineBg: "11111111-1111-4111-8111-111111111111",
  orphan: "44444444-4444-4444-8444-444444444444",
  logo: "88888888-8888-4888-8888-888888888888",
};

async function fetchAs(cookie: string, ...segments: string[]): Promise<number> {
  const res = await GET(
    new Request(`http://localhost:3000/api/uploads/${segments.join("/")}`, { headers: { cookie } }),
    ctx(...segments),
  );
  if (res.status === 200) expect(res.headers.get("cache-control")).toContain("private");
  return res.status;
}

describe("GET /api/uploads: kategoriye göre yetki (M4)", () => {
  beforeAll(async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#00f" } }).webp().toBuffer();
    for (const category of CATEGORIES) mkdirSync(path.join(UPLOAD_ROOT, category), { recursive: true });
    for (const id of Object.values(ids)) {
      for (const category of CATEGORIES) writeFileSync(path.join(UPLOAD_ROOT, category, `${id}.webp`), png);
    }
  });
  afterAll(() => {
    for (const category of CATEGORIES) rmSync(path.join(UPLOAD_ROOT, category), { recursive: true, force: true });
  });
  beforeEach(async () => {
    await truncateAll();
  });

  const login = (who: "admin" | Actor) => loginAs(who);

  it("logo: yalnızca ayarlar ya da davetiye görüntüleyebilen roller okur", async () => {
    await db.insert(systemSettings).values({ logo: `logo/${ids.logo}.webp` });
    const admin = await login("admin");
    const manager = await login(managerActor("entertainment"));
    const controller = await login(memberActor("casino", { check_in: "vc--" }));
    const venueOnly = await login(memberActor("fnb", { venues: "vced" }));
    const staff = await login(memberActor("casino", { reservations: "vce-", customers: "v---", check_in: "vc--" }));

    expect(await fetchAs(admin.cookie, "logo", `${ids.logo}.webp`)).toBe(200);
    expect(await fetchAs(manager.cookie, "logo", `${ids.logo}.webp`)).toBe(200);
    expect(await fetchAs(controller.cookie, "logo", `${ids.logo}.webp`)).toBe(403);
    expect(await fetchAs(venueOnly.cookie, "logo", `${ids.logo}.webp`)).toBe(403);
    expect(await fetchAs(staff.cookie, "logo", `${ids.logo}.webp`)).toBe(403);
  });

  it("invitation: davetiye yetkisi olmayan roller okuyamaz", async () => {
    const denied = [
      memberActor("casino", { check_in: "vc--" }),
      memberActor("fnb", { venues: "vced" }),
      memberActor("casino", { reservations: "vce-", customers: "v---", check_in: "vc--" }),
      memberActor("fnb", { reviews: "vce-", check_in: "vc--", notifications: "v---" }),
    ] as const;
    for (const who of denied) {
      const actor = await login(who);
      expect(await fetchAs(actor.cookie, "invitation", `${ids.mineBg}.webp`)).toBe(403);
    }
  });

  it("invitation: Entertainment yöneticisi kimin oluşturduğuna bakmadan davetiye görsellerini okur", async () => {
    const manager = await login(managerActor("entertainment"));
    const creator = await login(managerActor("entertainment"));
    const event = await createEvent(db, { organizerId: creator.id });
    await db.insert(eventInvitations).values({ eventId: event.id, backgroundImage: `invitation/${ids.mineBg}.webp` });

    expect(await fetchAs(manager.cookie, "invitation", `${ids.mineBg}.webp`)).toBe(200);
    expect(await fetchAs(manager.cookie, "invitation", `${ids.orphan}.webp`)).toBe(200);
  });

  it("yönetici davetiye görsellerini okur; kullanılmayan kategoriler yalnızca yöneticiye açıktır", async () => {
    const admin = await login("admin");
    const manager = await login(managerActor("entertainment"));
    expect(await fetchAs(admin.cookie, "invitation", `${ids.orphan}.webp`)).toBe(200);
    expect(await fetchAs(admin.cookie, "avatar", `${ids.orphan}.webp`)).toBe(200);
    expect(await fetchAs(manager.cookie, "avatar", `${ids.orphan}.webp`)).toBe(404);
    expect(await fetchAs(manager.cookie, "event", `${ids.orphan}.webp`)).toBe(404);
  });

  it("tanınmayan kategori ve eski düz yol 404 olur", async () => {
    const admin = await login("admin");
    expect(await fetchAs(admin.cookie, `${ids.orphan}.webp`)).toBe(404);
    expect(await fetchAs(admin.cookie, "gizli", `${ids.orphan}.webp`)).toBe(404);
    expect(await fetchAs(admin.cookie, "logo", "x", `${ids.orphan}.webp`)).toBe(404);
  });
});
