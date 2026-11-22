import { describe, expect, it } from "vitest";
import { findPlanTable } from "@/features/check-in/plan-focus";
import type { PlanTable } from "@/features/venue/plan-types";

const table = (id: string, label: string): PlanTable => ({
  id,
  label,
  capacity: 4,
  x: 0,
  y: 0,
  rotation: 0,
  isLoca: false,
  shape: "round",
  color: null,
});

const tables = [table("a1", "T1"), table("b2", "Loca 2")];

describe("findPlanTable", () => {
  it("masayı kimliğiyle bulur", () => {
    expect(findPlanTable(tables, "b2")?.label).toBe("Loca 2");
  });

  it("etiketi büyük/küçük harf ve boşluk gözetmeden eşler", () => {
    expect(findPlanTable(tables, " t1 ")?.id).toBe("a1");
    expect(findPlanTable(tables, "LOCA 2")?.id).toBe("b2");
  });

  it("boş ya da bilinmeyen anahtarda null döner", () => {
    expect(findPlanTable(tables, undefined)).toBeNull();
    expect(findPlanTable(tables, "")).toBeNull();
    expect(findPlanTable(tables, "   ")).toBeNull();
    expect(findPlanTable(tables, "T9")).toBeNull();
  });
});
