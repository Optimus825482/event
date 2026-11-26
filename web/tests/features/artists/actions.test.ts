import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { artists } from "@/db/schema";
import { artistActionDefs } from "@/features/artists/action-defs";
import type { Actor } from "@/features/auth/session";
import { createAction } from "@/lib/action";
import { assistantActor, managerActor, memberActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";

type Result = { ok: boolean; code?: string; data?: unknown; fieldErrors?: Record<string, string[]> };

function run(key: keyof typeof artistActionDefs, actor: Actor | null) {
  const { defineAction } = createAction({ getActor: async () => actor });
  return defineAction(artistActionDefs[key] as never) as (raw: unknown) => Promise<Result>;
}

describe("sanatçı eylemleri", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("Entertainment yöneticisi oluşturur, düzenler, siler", async () => {
    const ent = await persistActor(db, managerActor("entertainment"));
    const created = await run("create", ent)({ name: "Tarkan" });
    expect(created.ok).toBe(true);
    const { id } = created.data as { id: string };
    expect((await run("update", ent)({ id, name: "Tarkan T." })).ok).toBe(true);
    expect(await run("remove", ent)({ id })).toMatchObject({ ok: true, data: { id } });
    expect(await db.select().from(artists)).toHaveLength(0);
  });

  it("Yönetici Asistanı oluşturur ama silemez", async () => {
    const asst = await persistActor(db, assistantActor("entertainment"));
    const created = await run("create", asst)({ name: "Tarkan" });
    expect(created.ok).toBe(true);
    const { id } = created.data as { id: string };
    expect(await run("remove", asst)({ id })).toMatchObject({ ok: false, code: "forbidden" });
    expect(await db.select().from(artists)).toHaveLength(1);
  });

  it("yalnızca görüntüleme izni olan kullanıcı oluşturamaz", async () => {
    const viewer = await persistActor(db, memberActor("entertainment", { archive: "v---" }));
    expect(await run("create", viewer)({ name: "Tarkan" })).toMatchObject({ ok: false, code: "forbidden" });
    expect(await db.select().from(artists)).toHaveLength(0);
  });

  it("F&B ve Casino yöneticisi hiçbir sanatçı eylemini yapamaz", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    for (const dept of ["fnb", "casino"] as const) {
      const m = await persistActor(db, managerActor(dept));
      expect(await run("create", m)({ name: "X" })).toMatchObject({ ok: false, code: "forbidden" });
      expect(await run("update", m)({ id, name: "X" })).toMatchObject({ ok: false, code: "forbidden" });
      expect(await run("remove", m)({ id })).toMatchObject({ ok: false, code: "forbidden" });
    }
  });

  it("boş ad → invalid, fieldErrors.name", async () => {
    const ent = await persistActor(db, managerActor("entertainment"));
    const result = await run("create", ent)({ name: "  " });
    expect(result).toMatchObject({ ok: false, code: "invalid", fieldErrors: { name: ["Sanatçı adı gerekli"] } });
  });
});
