import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import type { Actor } from "@/features/auth/session";
import { createEvent, updateEvent } from "@/features/events/service";
import { createEventSchema, updateEventSchema } from "@/features/events/schemas";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";

const LONG_NAME_MESSAGE = "Sanatçı adı en fazla 200 karakter olabilir";

function inDays(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

async function makeActor(): Promise<Actor> {
  return persistActor(db, managerActor("entertainment"));
}

describe("etkinlik sanatçı alanı", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("sanatçı adıyla etkinlik oluşturulur", async () => {
    const actor = await makeActor();
    const input = createEventSchema.parse({ name: "Konser", startsAt: inDays(5), artistName: "  Sezen Aksu " });
    const ev = await createEvent(db, actor, input);
    expect(ev.artistName).toBe("Sezen Aksu");
  });

  it("boş sanatçı adı null kaydedilir", async () => {
    const actor = await makeActor();
    const input = createEventSchema.parse({ name: "Konser", startsAt: inDays(5), artistName: "   " });
    expect(input.artistName).toBeNull();
    const ev = await createEvent(db, actor, input);
    expect(ev.artistName).toBeNull();
  });

  it("201 karakter reddedilir", () => {
    const result = createEventSchema.safeParse({
      name: "Konser",
      startsAt: inDays(5),
      artistName: "a".repeat(201),
    });
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0]?.message).toBe(LONG_NAME_MESSAGE);
  });

  it("güncellemede alan verilmezse sanatçı korunur", async () => {
    const actor = await makeActor();
    const created = await createEvent(
      db,
      actor,
      createEventSchema.parse({ name: "Konser", startsAt: inDays(5), artistName: "Sezen Aksu" }),
    );
    const updated = await updateEvent(
      db,
      actor,
      updateEventSchema.parse({ id: created.id, name: "Konser 2", startsAt: created.startsAt }),
    );
    expect(updated.name).toBe("Konser 2");
    expect(updated.artistName).toBe("Sezen Aksu");
  });

  it("güncellemede boş verilirse sanatçı temizlenir", async () => {
    const actor = await makeActor();
    const created = await createEvent(
      db,
      actor,
      createEventSchema.parse({ name: "Konser", startsAt: inDays(5), artistName: "Sezen Aksu" }),
    );
    const updated = await updateEvent(
      db,
      actor,
      updateEventSchema.parse({ id: created.id, name: "Konser", startsAt: created.startsAt, artistName: "" }),
    );
    expect(updated.artistName).toBeNull();
  });
});
