import { describe, expect, it } from "vitest";
import { IMAGE_ROUTE_PREFIX, imageUrl } from "@/lib/image-url";

describe("imageUrl", () => {
  it("geçerli yol kendi kökenimizdeki rotaya çevrilir", () => {
    expect(IMAGE_ROUTE_PREFIX).toBe("/api/gorsel");
    expect(imageUrl("event/00000000-0000-4000-8000-0000000000c1.webp")).toBe(
      "/api/gorsel/event/00000000-0000-4000-8000-0000000000c1.webp",
    );
  });

  it.each([
    null,
    undefined,
    "",
    "logo/00000000-0000-4000-8000-0000000000c1.webp",
    "event/../x.webp",
    "https://evil.example/a.webp",
  ])("imageUrl(%s) null", (p) => {
    expect(imageUrl(p)).toBeNull();
  });
});
