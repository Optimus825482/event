import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { departmentMemberships, users } from "@/db/schema";
import { createMembership, createUser, pgErrorCode } from "../helpers/factories";
import { inRollback } from "./isolation";

describe("departman üyelikleri", () => {
  it("aynı kullanıcı aynı departmana iki kez eklenemez", async () => {
    await inRollback(async (tx) => {
      const u = await createUser(tx, { role: "user" });
      await createMembership(tx, { userId: u.id, department: "fnb", level: "member" });
      let caught: unknown;
      try {
        await tx.transaction(async (sp) => {
          await createMembership(sp, { userId: u.id, department: "fnb", level: "manager" });
        });
      } catch (err) {
        caught = err;
      }
      expect(pgErrorCode(caught)).toBe("23505");
    });
  });

  it("aynı kullanıcı iki ayrı departmana eklenebilir", async () => {
    await inRollback(async (tx) => {
      const u = await createUser(tx, { role: "user" });
      await createMembership(tx, { userId: u.id, department: "fnb", level: "member" });
      await createMembership(tx, { userId: u.id, department: "casino", level: "assistant" });
      const rows = await tx.select().from(departmentMemberships).where(eq(departmentMemberships.userId, u.id));
      expect(rows).toHaveLength(2);
    });
  });

  it("kullanıcı silinince üyelikleri de silinir", async () => {
    await inRollback(async (tx) => {
      const u = await createUser(tx, { role: "user" });
      await createMembership(tx, { userId: u.id, department: "entertainment", level: "manager" });
      await tx.delete(users).where(eq(users.id, u.id));
      const rows = await tx.select().from(departmentMemberships).where(eq(departmentMemberships.userId, u.id));
      expect(rows).toHaveLength(0);
    });
  });
});
