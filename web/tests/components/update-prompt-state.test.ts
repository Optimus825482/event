import { describe, expect, it } from "vitest";
import { dismissUpdate, initialUpdateState, onControllerChange } from "@/components/layout/update-prompt-state";

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
});
