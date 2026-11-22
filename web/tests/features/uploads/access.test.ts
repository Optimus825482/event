import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/uploads/[...path]/route";
import { db } from "@/db/client";
import { eventInvitations, invitationTemplates, systemSettings } from "@/db/schema";
import type { Role } from "@/features/auth/roles";
import { UPLOAD_ROOT } from "@/features/uploads/root";
import { truncateAll } from "../../helpers/db";
import { createEvent } from "../../helpers/factories";
import { loginAs } from "../realtime/helpers";

const ctx = (...segments: string[]) => ({ params: Promise.resolve({ path: segments }) });
const CATEGORIES = ["logo", "invitation", "avatar", "event"] as const;
const ids = {
  mineBg: "11111111-1111-4111-8111-111111111111",
  otherImage: "22222222-2222-4222-8222-222222222222",
  mineElement: "33333333-3333-4333-8333-333333333333",
  orphan: "44444444-4444-4444-8444-444444444444",
  sharedTemplate: "55555555-5555-4555-8555-555555555555",
  ownTemplate: "66666666-6666-4666-8666-666666666666",
  foreignTemplate: "77777777-7777-4777-8777-777777777777",
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

  const login = (role: Role) => loginAs(role);

  it("logo: yalnızca ayarlar ya da davetiye görüntüleyebilen roller okur", async () => {
    await db.insert(systemSettings).values({ logo: `logo/${ids.logo}.webp` });
    const admin = await login("admin");
    const organizer = await login("organizer");
    const controller = await login("controller");
    const venueOwner = await login("venue_owner");
    const staff = await login("staff");

    expect(await fetchAs(admin.cookie, "logo", `${ids.logo}.webp`)).toBe(200);
    expect(await fetchAs(organizer.cookie, "logo", `${ids.logo}.webp`)).toBe(200);
    expect(await fetchAs(controller.cookie, "logo", `${ids.logo}.webp`)).toBe(403);
    expect(await fetchAs(venueOwner.cookie, "logo", `${ids.logo}.webp`)).toBe(403);
    expect(await fetchAs(staff.cookie, "logo", `${ids.logo}.webp`)).toBe(403);
  });

  it("invitation: davetiye yetkisi olmayan roller okuyamaz", async () => {
    for (const role of ["controller", "venue_owner", "staff", "leader"] as const) {
      const actor = await login(role);
      expect(await fetchAs(actor.cookie, "invitation", `${ids.mineBg}.webp`)).toBe(403);
    }
  });

  it("invitation: organizatör yalnızca kendi etkinliğinin davetiyesindeki görselleri okur (başkasınınki 404)", async () => {
    const organizer = await login("organizer");
    const other = await login("organizer");
    const mine = await createEvent(db, { organizerId: organizer.id });
    const theirs = await createEvent(db, { organizerId: other.id });
    await db.insert(eventInvitations).values([
      {
        eventId: mine.id,
        backgroundImage: `invitation/${ids.mineBg}.webp`,
        eventImages: [`invitation/${ids.mineElement}.webp`],
      },
      { eventId: theirs.id, eventImages: [`invitation/${ids.otherImage}.webp`] },
    ]);

    expect(await fetchAs(organizer.cookie, "invitation", `${ids.mineBg}.webp`)).toBe(200);
    expect(await fetchAs(organizer.cookie, "invitation", `${ids.mineElement}.webp`)).toBe(200);
    expect(await fetchAs(organizer.cookie, "invitation", `${ids.otherImage}.webp`)).toBe(404);
    expect(await fetchAs(organizer.cookie, "invitation", `${ids.orphan}.webp`)).toBe(404);
    expect(await fetchAs(other.cookie, "invitation", `${ids.otherImage}.webp`)).toBe(200);
  });

  it("invitation: şablon görselleri şablonu görebilene açıktır; başkasının özel şablonu 404", async () => {
    const organizer = await login("organizer");
    const other = await login("organizer");
    await db.insert(invitationTemplates).values([
      { name: "ortak", isDefault: true, backgroundImage: `invitation/${ids.sharedTemplate}.webp` },
      {
        name: "benim",
        createdById: organizer.id,
        elements: [{ type: "image", imageUrl: `invitation/${ids.ownTemplate}.webp` }],
      },
      { name: "onun", createdById: other.id, backgroundImage: `invitation/${ids.foreignTemplate}.webp` },
    ]);

    expect(await fetchAs(organizer.cookie, "invitation", `${ids.sharedTemplate}.webp`)).toBe(200);
    expect(await fetchAs(organizer.cookie, "invitation", `${ids.ownTemplate}.webp`)).toBe(200);
    expect(await fetchAs(organizer.cookie, "invitation", `${ids.foreignTemplate}.webp`)).toBe(404);
  });

  it("yönetici davetiye görsellerini okur; kullanılmayan kategoriler yalnızca yöneticiye açıktır", async () => {
    const admin = await login("admin");
    const organizer = await login("organizer");
    expect(await fetchAs(admin.cookie, "invitation", `${ids.orphan}.webp`)).toBe(200);
    expect(await fetchAs(admin.cookie, "avatar", `${ids.orphan}.webp`)).toBe(200);
    expect(await fetchAs(organizer.cookie, "avatar", `${ids.orphan}.webp`)).toBe(404);
    expect(await fetchAs(organizer.cookie, "event", `${ids.orphan}.webp`)).toBe(404);
  });

  it("tanınmayan kategori ve eski düz yol 404 olur", async () => {
    const admin = await login("admin");
    expect(await fetchAs(admin.cookie, `${ids.orphan}.webp`)).toBe(404);
    expect(await fetchAs(admin.cookie, "gizli", `${ids.orphan}.webp`)).toBe(404);
    expect(await fetchAs(admin.cookie, "logo", "x", `${ids.orphan}.webp`)).toBe(404);
  });
});
