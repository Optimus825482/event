import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { db } from "@/db/client";
import { userPermissions, users } from "@/db/schema";
import { ForbiddenError, UnauthenticatedError } from "@/features/auth/errors";
import { loadPermissions } from "@/features/auth/permissions";
import type { Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/session";
import { createAction, DomainError } from "@/lib/action";
import { truncateAll } from "../helpers/db";
import { createUser } from "../helpers/factories";

async function makeActor(role: Role): Promise<Actor> {
  const user = await createUser(db, { role });
  return { id: user.id, username: user.username, role: user.role, staffId: user.staffId, memberships: [], permissions: [] };
}

function actionFor(actor: Actor | null) {
  return createAction({ getActor: async () => actor }).defineAction;
}

const idInput = z.object({ id: z.uuid() });

describe("defineAction", () => {
  let stderr: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await truncateAll();
    stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderr.mockRestore();
  });

  it("oturumsuz çağrı unauthenticated döner ve handler çalışmaz", async () => {
    const handler = vi.fn(async () => "x");
    const run = actionFor(null)({ module: "events", verb: "view", input: z.object({}), handler });

    expect(await run({})).toEqual({
      ok: false,
      code: "unauthenticated",
      message: "Oturum gerekli",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("controller events/create için forbidden alır ve handler çalışmaz", async () => {
    const actor = await makeActor("controller");
    const handler = vi.fn(async () => "x");
    const run = actionFor(actor)({ module: "events", verb: "create", input: z.object({}), handler });

    expect(await run({})).toEqual({
      ok: false,
      code: "forbidden",
      message: "Bu işlem için yetkiniz yok",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("yetki girdi doğrulamasından önce denetlenir", async () => {
    const actor = await makeActor("controller");
    const run = actionFor(actor)({
      module: "events",
      verb: "create",
      input: idInput,
      handler: async () => "x",
    });

    const res = await run({ id: "abc" });

    expect(res).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("geçerli girdiyle handler'ı bağlamla çağırır ve veriyi döner", async () => {
    const actor = await makeActor("organizer");
    const id = crypto.randomUUID();
    const run = actionFor(actor)({
      module: "events",
      verb: "create",
      input: idInput,
      handler: async (ctx) => ({ actorId: ctx.actor.id, id: ctx.input.id, hasDb: ctx.db === db }),
    });

    expect(await run({ id })).toEqual({
      ok: true,
      data: { actorId: actor.id, id, hasDb: true },
    });
  });

  it("kullanıcıya özel izin satırı yetkiyi daraltır", async () => {
    const base = await makeActor("organizer");
    await db.insert(userPermissions).values({
      userId: base.id,
      module: "events",
      canView: true,
      canCreate: false,
    });
    // İzin satırları artık aktörle (oturumdan) gelir; eylem ayrıca veritabanından okumaz.
    const actor: Actor = { ...base, permissions: await loadPermissions(base.id) };
    const handler = vi.fn(async () => "x");
    const create = actionFor(actor)({ module: "events", verb: "create", input: z.object({}), handler });
    const view = actionFor(actor)({ module: "events", verb: "view", input: z.object({}), handler });

    expect(await create({})).toMatchObject({ ok: false, code: "forbidden" });
    expect(await view({})).toEqual({ ok: true, data: "x" });
  });

  it("admin için izin satırı olmadan da çalışır", async () => {
    const actor = await makeActor("admin");
    const run = actionFor(actor)({
      module: "settings",
      verb: "edit",
      input: z.object({}),
      handler: async () => 1,
    });
    expect(await run({})).toEqual({ ok: true, data: 1 });
  });

  it("geçersiz girdi invalid ve noktalı yolla fieldErrors döner; veritabanı metni yoktur", async () => {
    const actor = await makeActor("organizer");
    const handler = vi.fn(async () => "x");
    const run = actionFor(actor)({
      module: "events",
      verb: "create",
      input: z.object({ id: z.uuid(), nested: z.object({ n: z.number() }) }),
      handler,
    });

    const res = await run({ id: "abc", nested: { n: "x" } });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("invalid");
    expect(res.message).toBe("Girdi geçersiz");
    expect(res.fieldErrors?.id?.length).toBeGreaterThan(0);
    expect(res.fieldErrors?.["nested.n"]?.length).toBeGreaterThan(0);
    expect(JSON.stringify(res)).not.toMatch(/relation|select|insert|postgres/i);
    expect(handler).not.toHaveBeenCalled();
  });

  it("beklenmeyen hata genel mesajla döner, ayrıntı sunucuda kaydedilir", async () => {
    const actor = await makeActor("organizer");
    const run = actionFor(actor)({
      module: "events",
      verb: "create",
      input: z.object({}),
      handler: async () => {
        throw new Error('relation "x" does not exist');
      },
    });

    const res = await run({});

    expect(res).toEqual({ ok: false, code: "error", message: "Beklenmeyen bir hata oluştu" });
    const logged = stderr.mock.calls.map((c: unknown[]) => String(c[0])).join("");
    expect(logged).toContain('relation \\"x\\" does not exist');
    expect(JSON.parse(logged.trim().split("\n")[0] ?? "{}")).toMatchObject({ level: "error" });
  });

  it("DomainError kodu ve mesajıyla döner", async () => {
    const actor = await makeActor("organizer");
    const conflict = actionFor(actor)({
      module: "events",
      verb: "create",
      input: z.object({}),
      handler: async () => {
        throw new DomainError("conflict", "Bu masa dolu");
      },
    });
    const missing = actionFor(actor)({
      module: "events",
      verb: "create",
      input: z.object({}),
      handler: async () => {
        throw new DomainError("not_found", "Etkinlik bulunamadı");
      },
    });

    expect(await conflict({})).toEqual({ ok: false, code: "conflict", message: "Bu masa dolu" });
    expect(await missing({})).toEqual({
      ok: false,
      code: "not_found",
      message: "Etkinlik bulunamadı",
    });
  });

  it("handler içindeki ForbiddenError ve UnauthenticatedError eşlenir", async () => {
    const actor = await makeActor("organizer");
    const forbidden = actionFor(actor)({
      module: "events",
      verb: "edit",
      input: z.object({}),
      handler: async () => {
        throw new ForbiddenError();
      },
    });
    const unauth = actionFor(actor)({
      module: "events",
      verb: "edit",
      input: z.object({}),
      handler: async () => {
        throw new UnauthenticatedError();
      },
    });

    expect(await forbidden({})).toMatchObject({ ok: false, code: "forbidden" });
    expect(await unauth({})).toMatchObject({ ok: false, code: "unauthenticated" });
  });

  it("PostgreSQL 23505 (gerçek tekil kısıt ihlali) conflict döner", async () => {
    const actor = await makeActor("organizer");
    const other = await createUser(db, { username: "tekrar_kullanici" });
    const run = actionFor(actor)({
      module: "events",
      verb: "create",
      input: z.object({}),
      handler: async (ctx) => {
        await ctx.db.update(users).set({ username: other.username }).where(eq(users.id, actor.id));
      },
    });

    expect(await run({})).toEqual({ ok: false, code: "conflict", message: "Kayıt zaten mevcut" });
  });

  it("PostgreSQL 23503 conflict döner (kod cause üzerinde olsa da)", async () => {
    const actor = await makeActor("organizer");
    const run = actionFor(actor)({
      module: "events",
      verb: "create",
      input: z.object({}),
      handler: async () => {
        throw new Error("sorgu başarısız", { cause: Object.assign(new Error("fk"), { code: "23503" }) });
      },
    });

    expect(await run({})).toEqual({
      ok: false,
      code: "conflict",
      message: "Kayıt başka kayıtlarca kullanılıyor",
    });
  });

  it("23505 doğrudan hata üzerinde de tanınır", async () => {
    const actor = await makeActor("organizer");
    const run = actionFor(actor)({
      module: "events",
      verb: "create",
      input: z.object({}),
      handler: async () => {
        throw Object.assign(new Error("dup"), { code: "23505" });
      },
    });
    expect(await run({})).toMatchObject({ ok: false, code: "conflict" });
  });

  it("Next yönlendirmesi yutulmaz, yeniden fırlatılır", async () => {
    const actor = await makeActor("organizer");
    const run = actionFor(actor)({
      module: "events",
      verb: "create",
      input: z.object({}),
      handler: async () => {
        redirect("/events");
      },
    });

    await expect(run({})).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });

  it("oturum çözümü patlarsa error döner", async () => {
    const run = createAction({
      getActor: async () => {
        throw new Error("veritabanı kapalı");
      },
    }).defineAction({ module: "events", verb: "view", input: z.object({}), handler: async () => 1 });

    expect(await run({})).toEqual({ ok: false, code: "error", message: "Beklenmeyen bir hata oluştu" });
  });
});
