import { describe, expect, it } from "vitest";
import { legacyAudience } from "../../../scripts/migrate-legacy/content";

describe("eski bildirim hedefi → kitle", () => {
  it("all ve admin aynen kalır", () => {
    expect(legacyAudience("all")).toBe("all");
    expect(legacyAudience("admin")).toBe("admin");
  });

  it("eski rol hedefleri bütün bir departmana açılmaz, yalnızca yöneticiye gider", () => {
    expect(legacyAudience("leader")).toBe("admin");
    expect(legacyAudience("staff")).toBe("admin");
  });

  it("tanınmayan değer de yöneticiye gider (eklemede hata vermez)", () => {
    expect(legacyAudience("organizer")).toBe("admin");
    expect(legacyAudience("")).toBe("admin");
  });
});
