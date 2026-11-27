import { describe, expect, it } from "vitest";
import { imageStatusOf, validImagePath } from "@/features/sales-site/image-status";

const P = "event/00000000-0000-4000-8000-000000000001.webp";
const A = "artist/00000000-0000-4000-8000-000000000002.webp";
const ART = "00000000-0000-4000-8000-0000000000aa";

describe("imageStatusOf", () => {
  it.each([
    [{ coverImage: P, heroImage: P, artistId: null, artistImage: null }, "complete", []],
    [{ coverImage: P, heroImage: P, artistId: ART, artistImage: A }, "complete", []],
    [{ coverImage: P, heroImage: P, artistId: ART, artistImage: null }, "missing", ["artist"]],
    [{ coverImage: null, heroImage: null, artistId: null, artistImage: null }, "missing", ["cover", "hero"]],
    [{ coverImage: "eski/yol.jpg", heroImage: P, artistId: null, artistImage: null }, "missing", ["cover"]],
  ] as const)("imageStatusOf(%o) = %s %o", (i, status, missing) => {
    expect(imageStatusOf(i)).toEqual({ status, missing: [...missing] });
  });

  it("geçersiz yol validImagePath ile null döner", () => {
    expect(validImagePath("logo/00000000-0000-4000-8000-000000000001.webp")).toBeNull();
    expect(validImagePath(P)).toBe(P);
    expect(validImagePath(null)).toBeNull();
  });
});
