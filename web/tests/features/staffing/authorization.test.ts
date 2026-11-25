import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { can } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { staffingActionDefs } from "@/features/staffing/action-defs";
import { createAction } from "@/lib/action";
import { assistantActor, managerActor, memberActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { makeActor } from "./helpers";

function saveTeamsFor(actor: Actor) {
  const { defineAction } = createAction({ getActor: async () => actor });
  return defineAction(staffingActionDefs.saveTeams);
}

describe("ekip organizasyonu yetkisi (staff modülü)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("F&B yöneticisi ekip organizasyonunu düzenler", async () => {
    const actor = await makeActor(managerActor("fnb"));
    const event = await f.createEvent(db, { organizerId: actor.id });
    const res = await saveTeamsFor(actor)({ eventId: event.id, teams: [{ name: "A", members: [] }] });
    expect(res.ok).toBe(true);
  });

  it("F&B yönetici asistanı düzenler", async () => {
    const actor = await makeActor(assistantActor("fnb"));
    const event = await f.createEvent(db);
    const res = await saveTeamsFor(actor)({ eventId: event.id, teams: [{ name: "A", members: [] }] });
    expect(res.ok).toBe(true);
  });

  it("Entertainment yöneticisi ekip organizasyonunu düzenleyemez", async () => {
    const actor = await makeActor(managerActor("entertainment"));
    const event = await f.createEvent(db);
    const res = await saveTeamsFor(actor)({ eventId: event.id, teams: [{ name: "A", members: [] }] });
    expect(res).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("Casino yöneticisi ekip organizasyonunu düzenleyemez", async () => {
    const actor = await makeActor(managerActor("casino"));
    const event = await f.createEvent(db);
    const res = await saveTeamsFor(actor)({ eventId: event.id, teams: [{ name: "A", members: [] }] });
    expect(res).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("F&B kullanıcısı yalnızca açılan yetkiyle düzenler", async () => {
    const closed = await makeActor(memberActor("fnb", { staff: "v---" }));
    const open = await makeActor(memberActor("fnb", { staff: "v-e-" }));
    const event = await f.createEvent(db);
    const input = { eventId: event.id, teams: [{ name: "A", members: [] }] };
    expect(await saveTeamsFor(closed)(input)).toMatchObject({ ok: false, code: "forbidden" });
    expect((await saveTeamsFor(open)(input)).ok).toBe(true);
  });

  it("etkinliği okumak events:view olarak kalır", () => {
    expect(can(managerActor("fnb"), "events", "view")).toBe(true);
    expect(can(managerActor("fnb"), "events", "edit")).toBe(false);
  });
});
