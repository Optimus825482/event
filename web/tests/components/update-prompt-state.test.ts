import { describe, expect, it } from "vitest";
import { dismissUpdate, initialUpdateState, onControllerChange, onServerBuild } from "@/components/layout/update-prompt-state";
import { buildLabel, normalizeBuild } from "@/lib/app-build";

describe("update prompt state", () => {
  it("ilk kurulumdaki devralmada (denetleyici yokken) istem göstermez", () => {
    const first = onControllerChange(initialUpdateState(false));
    expect(first.visible).toBe(false);
    expect(first.hadController).toBe(true);
  });

  it("ilk kurulumdan sonraki bir devralma istemi gösterir", () => {
    const afterInstall = onControllerChange(initialUpdateState(false));
    expect(onControllerChange(afterInstall).visible).toBe(true);
  });

  it("açılışta denetleyici varsa ilk devralma istemi gösterir", () => {
    expect(onControllerChange(initialUpdateState(true)).visible).toBe(true);
  });

  it("Sonra istemi gizler; yeni devralma yeniden gösterir", () => {
    const shown = onControllerChange(initialUpdateState(true));
    const hidden = dismissUpdate(shown);
    expect(hidden.visible).toBe(false);
    expect(onControllerChange(hidden).visible).toBe(true);
  });

  it("gösterilmiyorken gizleme durumu değiştirmez", () => {
    const state = initialUpdateState(true);
    expect(dismissUpdate(state)).toBe(state);
  });

  describe("sunucu güncelleme numarası", () => {
    const start = initialUpdateState(false);

    it("sunucu farklı bir numara bildirince istem numarayla birlikte açılır", () => {
      expect(onServerBuild(start, "127", "128")).toMatchObject({ visible: true, serverBuild: "128" });
    });

    it("aynı numara ya da numarasız taraf (yerel geliştirme, hatalı yanıt) durumu değiştirmez", () => {
      expect(onServerBuild(start, "128", "128")).toBe(start);
      expect(onServerBuild(start, null, "128")).toBe(start);
      expect(onServerBuild(start, "128", null)).toBe(start);
    });

    it("Sonra denmiş güncelleme sonraki yoklamada yeniden açılmaz; daha yenisi açılır", () => {
      const dismissed = dismissUpdate(onServerBuild(start, "127", "128"));
      expect(onServerBuild(dismissed, "127", "128")).toBe(dismissed);
      expect(onServerBuild(dismissed, "127", "129")).toMatchObject({ visible: true, serverBuild: "129" });
    });
  });

  describe("normalizeBuild", () => {
    it("sayı ve kısa metni kabul eder, gerisini yok sayar", () => {
      expect(normalizeBuild(" 128 ")).toBe("128");
      expect(normalizeBuild(128)).toBe("128");
      expect(normalizeBuild("")).toBeNull();
      expect(normalizeBuild(undefined)).toBeNull();
      expect(normalizeBuild("<script>")).toBeNull();
      expect(buildLabel("128")).toBe("#128");
    });
  });
});
