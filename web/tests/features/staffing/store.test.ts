import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { createOrganizationStore, toSavePayload } from "@/features/staffing/components/store";
import { getOrganization, saveOrganization } from "@/features/staffing/organization-service";
import { saveOrganizationSchema } from "@/features/staffing/schemas";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { setupEvent } from "./helpers";

/** Sihirbaz deposu: taslak kuralları ve sunucuya giden yükün şemayla/servisle uyumu. */
describe("sihirbaz deposu", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("masa başka gruba tıklanınca taşınır (tek grup kuralı taslakta da korunur)", async () => {
    const { actor, event, tables } = await setupEvent();
    const store = createOrganizationStore(await getOrganization(db, actor, event.id));
    store.getState().addGroup();
    store.getState().addGroup();
    const [a, b] = store.getState().groups;
    store.getState().toggleTable(a!.id, tables[0]!.id);
    store.getState().toggleTable(b!.id, tables[0]!.id);
    const [a2, b2] = store.getState().groups;
    expect(a2!.tableIds).toEqual([]);
    expect(b2!.tableIds).toEqual([tables[0]!.id]);
    expect(store.getState().dirty).toBe(true);
  });

  it("ekip silinince grup ve atama bağları boşalır; grup ekibe bağlanınca gruptaki masa atamaları ekibe geçer", async () => {
    const { actor, event, tables, people } = await setupEvent();
    const store = createOrganizationStore(await getOrganization(db, actor, event.id));
    const s = () => store.getState();
    s().addTeam();
    s().addGroup();
    const team = s().teams[0]!;
    const group = s().groups[0]!;
    s().toggleTable(group.id, tables[0]!.id);
    s().addAssignment("table");
    const assignment = s().assignments[0]!;
    s().updateAssignment(assignment.id, { staffId: people[1]!.id });
    s().toggleAssignmentTable(assignment.id, tables[0]!.id);

    s().setGroupTeam(group.id, team.id);
    expect(s().groups[0]).toMatchObject({ teamId: team.id, color: team.color });
    expect(s().assignments[0]?.teamId).toBe(team.id);

    s().removeTeam(team.id);
    expect(s().groups[0]?.teamId).toBeNull();
    expect(s().assignments[0]?.teamId).toBeNull();
  });

  it("otomatik dağıtım taslağa yazılır, localar hariç, mevcut masa ataması yeniden kullanılır", async () => {
    const { actor, event, people } = await setupEvent({ tableCount: 3, staffCount: 2 });
    await f.createTable(db, event.id, { label: "LOCA", isLoca: true });
    const store = createOrganizationStore(await getOrganization(db, actor, event.id));
    const s = () => store.getState();
    s().autoAssign([people[0]!.id, people[1]!.id], "balanced", null);
    expect(s().assignments).toHaveLength(2);
    expect(s().assignments.flatMap((a) => a.tableIds)).toHaveLength(3);
    s().autoAssign([people[0]!.id], "zone", null);
    expect(s().assignments).toHaveLength(2);
    expect(s().assignments.find((a) => a.staffId === people[0]!.id)?.tableIds).toHaveLength(3);
  });

  it("taslak yükü şemadan geçer, kaydedilir ve geri okunduğunda aynı kimliklerle döner", async () => {
    const { actor, event, tables, people } = await setupEvent();
    const store = createOrganizationStore(await getOrganization(db, actor, event.id));
    const s = () => store.getState();
    s().addTeam();
    s().toggleMember(s().teams[0]!.id, people[0]!.id);
    s().addGroup();
    s().toggleTable(s().groups[0]!.id, tables[0]!.id);
    s().setGroupTeam(s().groups[0]!.id, s().teams[0]!.id);
    s().addAssignment("special_task");
    s().updateAssignment(s().assignments[0]!.id, { specialTaskLocation: "Vestiyer", specialTaskStartTime: "19:00" });
    s().addExtra();
    s().updateExtra(s().extraStaff[0]!.id, { fullName: "Geçici", groupIds: [s().groups[0]!.id] });

    const parsed = saveOrganizationSchema.safeParse(toSavePayload(event.id, s()));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    await saveOrganization(db, actor, parsed.data);

    const saved = await getOrganization(db, actor, event.id);
    expect(saved.teams.map((t) => t.id)).toEqual(s().teams.map((t) => t.id));
    expect(saved.groups[0]).toMatchObject({ id: s().groups[0]!.id, teamId: s().teams[0]!.id, tableIds: [tables[0]!.id] });
    expect(saved.assignments[0]).toMatchObject({ id: s().assignments[0]!.id, specialTaskLocation: "Vestiyer" });
    expect(saved.extraStaff[0]?.groupIds).toEqual([s().groups[0]!.id]);

    // Sunucudan dönen veriyle yeniden yükleme (getOrganization biçimi) şemadan yine geçer.
    s().reset(saved);
    expect(s().dirty).toBe(false);
    expect(saveOrganizationSchema.safeParse(toSavePayload(event.id, s())).success).toBe(true);
  });
});
