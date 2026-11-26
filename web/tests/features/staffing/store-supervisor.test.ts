import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { createOrganizationStore, toSavePayload } from "@/features/staffing/components/store";
import { getOrganization, saveOrganization } from "@/features/staffing/organization-service";
import { saveOrganizationSchema } from "@/features/staffing/schemas";
import { truncateAll } from "../../helpers/db";
import { setupEvent } from "./helpers";

describe("sihirbaz deposu: grup süpervizörü", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("seçim ve kaldırma taslağı kirletir, geri alınır ve kayıt yüküne girer; aynı değer taslağı kirletmez", async () => {
    const { actor, event, people } = await setupEvent();
    const store = createOrganizationStore(await getOrganization(db, actor, event.id));
    const s = () => store.getState();
    s().addGroup();
    const group = s().groups[0]!;
    // Yeni grupla kirlenir; geçmişi sıfırlayıp yalnızca süpervizör işlemini sınarız.
    s().reset({ ...(await getOrganization(db, actor, event.id)), groups: s().groups });
    expect(s().dirty).toBe(false);

    s().setGroupSupervisor(group.id, null);
    expect(s().dirty).toBe(false);

    s().setGroupSupervisor(group.id, people[0]!.id);
    expect(s().dirty).toBe(true);
    expect(s().groups[0]?.supervisorStaffId).toBe(people[0]!.id);
    expect(toSavePayload(event.id, s()).groups[0]?.supervisorStaffId).toBe(people[0]!.id);

    s().undo();
    expect(s().groups[0]?.supervisorStaffId).toBeNull();
    s().redo();
    s().setGroupSupervisor(group.id, null);
    expect(s().dirty).toBe(true);
    expect(s().groups[0]?.supervisorStaffId).toBeNull();
    expect(toSavePayload(event.id, s()).groups[0]?.supervisorStaffId).toBeNull();
  });

  it("yük şemadan geçer ve 'Tümünü kaydet' yoluyla kalıcı olur; kaldırma da kalıcıdır", async () => {
    const { actor, event, people } = await setupEvent();
    const store = createOrganizationStore(await getOrganization(db, actor, event.id));
    const s = () => store.getState();
    s().addGroup();
    s().setGroupSupervisor(s().groups[0]!.id, people[1]!.id);
    await saveOrganization(db, actor, saveOrganizationSchema.parse(toSavePayload(event.id, s())));
    expect((await getOrganization(db, actor, event.id)).groups[0]?.supervisorStaffId).toBe(people[1]!.id);

    const again = createOrganizationStore(await getOrganization(db, actor, event.id));
    again.getState().setGroupSupervisor(again.getState().groups[0]!.id, null);
    await saveOrganization(db, actor, saveOrganizationSchema.parse(toSavePayload(event.id, again.getState())));
    expect((await getOrganization(db, actor, event.id)).groups[0]?.supervisorStaffId).toBeNull();
  });
});
