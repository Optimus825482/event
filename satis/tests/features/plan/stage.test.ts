import { describe, expect, it } from "vitest";
import type { PlanDecor } from "@/features/plan/decor";
import type { PlanModel, PlanTableModel } from "@/features/plan/model";
import { STAGE_HEIGHT, stageInfo, TARGET_HEIGHT, towardStage } from "@/features/plan/three/stage";

function makeTable(id: string, x: number, y: number, status: PlanTableModel["status"] = "available"): PlanTableModel {
  return {
    id,
    label: id.toUpperCase(),
    x,
    y,
    rotation: 0,
    shape: "round",
    isLoca: false,
    width: 40,
    height: 40,
    category: "standard",
    categoryLabel: "Standart",
    capacity: 8,
    seats: 8,
    seatNos: [1, 2, 3, 4, 5, 6, 7, 8],
    free: status === "available" ? 8 : 0,
    freeSeats: status === "available" ? [1, 2, 3, 4, 5, 6, 7, 8] : [],
    wholeOnly: false,
    status,
    countLabel: "8/8",
    ariaLabel: `Masa ${id.toUpperCase()}`,
  };
}

function makeModel(
  canvas: { width: number; height: number },
  decor: PlanDecor[],
  tables: PlanTableModel[],
): PlanModel {
  return { canvas, saleMode: "seat", tables, decor, lines: [] };
}

describe("stage", () => {
  it("ana sahne en büyük stage dekorudur; ön yüz masaların olduğu yana bakar", () => {
    // 960x705 tuval -> 64x47 m. Sahne ortası x=480 (0m), y=114 ((114-352.5)/15 = -15.9m)
    const stageDecor: PlanDecor = {
      id: "st1",
      kind: "stage",
      x: 480 - 130.5, // 261 px = 17.4 m
      y: 114 - 63.75, // 127.5 px = 8.5 m
      width: 261,
      height: 127.5,
      rotation: 0,
      label: "Sahne",
    };
    const smallStage: PlanDecor = {
      id: "st2",
      kind: "stage",
      x: 100,
      y: 100,
      width: 60,
      height: 45,
      rotation: 0,
      label: "Küçük",
    };
    const info = stageInfo(makeModel({ width: 960, height: 705 }, [smallStage, stageDecor], [makeTable("m1", 480, 500)]));
    expect(info.source).toBe("decor");
    expect(info.front.x).toBeCloseTo(0, 5);
    expect(info.front.z).toBeCloseTo(1, 5);
    expect(info.width).toBeCloseTo(17.4, 2);
    expect(info.depth).toBeCloseTo(8.5, 2);
    expect(info.center.x).toBeCloseTo(0, 2);
    expect(info.center.z).toBeCloseTo(-15.9, 2);
  });

  it("sahne solda, masalar sağdaysa ön yüz +x'tir ve genişlik/derinlik yer değiştirir", () => {
    const stageDecor: PlanDecor = {
      id: "st1",
      kind: "stage",
      x: 50,
      y: 200,
      width: 120, // 8m
      height: 240, // 16m
      rotation: 0,
      label: "Sahne",
    };
    const info = stageInfo(makeModel({ width: 960, height: 705 }, [stageDecor], [makeTable("m1", 600, 320)]));
    expect(info.front.x).toBeCloseTo(1, 5);
    expect(info.front.z).toBeCloseTo(0, 5);
    expect(info.width).toBeCloseTo(16, 2);
    expect(info.depth).toBeCloseTo(8, 2);
  });

  it("90° döndürülmüş dekorda eksenler dekorun dönüşünü izler", () => {
    const stageDecor: PlanDecor = {
      id: "st1",
      kind: "stage",
      x: 480 - 60,
      y: 120 - 120,
      width: 120, // 8m (u ekseni -> 90° dönünce (0, 1))
      height: 240, // 16m (v ekseni -> 90° dönünce (-1, 0))
      rotation: 90,
      label: "Sahne",
    };
    const info = stageInfo(makeModel({ width: 960, height: 705 }, [stageDecor], [makeTable("m1", 480, 500)]));
    expect(info.front.x).toBeCloseTo(0, 5);
    expect(info.front.z).toBeCloseTo(1, 5);
    expect(info.width).toBeCloseTo(16, 2);
    expect(info.depth).toBeCloseTo(8, 2);
  });

  it("hedef sahne ortasından derinliğin beşte biri kadar geride ve 2,12 m yüksektedir", () => {
    const stageDecor: PlanDecor = {
      id: "st1",
      kind: "stage",
      x: 480 - 130.5,
      y: 114 - 63.75,
      width: 261,
      height: 127.5,
      rotation: 0,
      label: "Sahne",
    };
    const info = stageInfo(makeModel({ width: 960, height: 705 }, [stageDecor], [makeTable("m1", 480, 500)]));
    expect(info.target[0]).toBeCloseTo(0, 2);
    expect(info.target[1]).toBe(TARGET_HEIGHT);
    expect(info.target[2]).toBeCloseTo(-15.9 - 8.5 * 0.2, 2);
  });

  it("ekran sahnenin arka kenarındadır: genişlik min(13,9; sahne × 0,8), oran 13,9:5,25, yüzü seyirciye", () => {
    const stageDecor: PlanDecor = {
      id: "st1",
      kind: "stage",
      x: 480 - 130.5,
      y: 114 - 63.75,
      width: 261,
      height: 127.5,
      rotation: 0,
      label: "Sahne",
    };
    const info = stageInfo(makeModel({ width: 960, height: 705 }, [stageDecor], [makeTable("m1", 480, 500)]));
    expect(info.screen.width).toBeCloseTo(13.9, 1);
    expect(info.screen.height).toBeCloseTo(5.25, 1);
    expect(info.screen.position[0]).toBeCloseTo(0, 2);
    expect(info.screen.position[1]).toBeCloseTo(STAGE_HEIGHT + 0.3 + info.screen.height / 2, 2);
    expect(info.screen.position[2]).toBeCloseTo(-15.9 - (8.5 / 2 - 0.05), 2);
    expect(info.screen.rotationY).toBeCloseTo(0, 5);
  });

  it("sahne dekoru yoksa yedek: arka duvarın ortası, front +z, source fallback", () => {
    const info = stageInfo(makeModel({ width: 960, height: 705 }, [], [makeTable("m1", 480, 500)]));
    expect(info.source).toBe("fallback");
    expect(info.front).toEqual({ x: 0, z: 1 });
    expect(info.center).toEqual({ x: 0, z: -23.5 + 2 });
    expect(info.target[0]).toBeCloseTo(0, 5);
    expect(info.target[1]).toBe(TARGET_HEIGHT);
    expect(Number.isNaN(info.target[2])).toBe(false);
  });

  it("masa yokken ve bozuk dekorda NaN üretmez", () => {
    const info = stageInfo(
      makeModel(
        { width: 960, height: 705 },
        [{ id: "b", kind: "stage", x: 100, y: 100, width: 0, height: 0, rotation: 0, label: "" }],
        [],
      ),
    );
    expect(Number.isFinite(info.center.x)).toBe(true);
    expect(Number.isFinite(info.front.x)).toBe(true);
    expect(Number.isFinite(info.screen.width)).toBe(true);
  });

  it("towardStage birim vektördür; masa hedefin üstündeyse −front döner", () => {
    const info = stageInfo(makeModel({ width: 960, height: 705 }, [], []));
    const v = towardStage(info, { x: 3, z: 4 });
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(1, 5);
    const atTarget = towardStage(info, { x: info.target[0], z: info.target[2] });
    expect(atTarget.x).toBeCloseTo(-info.front.x, 5);
    expect(atTarget.z).toBeCloseTo(-info.front.z, 5);
  });
});
