import { describe, expect, it } from "vitest";
import { imageStatusOf, validHeroPath, validImagePath } from "@/features/sales-site/image-status";

const P = "event/00000000-0000-4000-8000-000000000001.webp";
const A = "artist/00000000-0000-4000-8000-000000000002.webp";
const ART = "00000000-0000-4000-8000-0000000000aa";
const V = "event/00000000-0000-4000-8000-000000000003.webm";

describe("imageStatusOf", () => {
  it.each([
    [{ coverImage: P, heroImage: P, artistId: null, artistImage: null }, "complete", []],
    [{ coverImage: P, heroImage: P, artistId: ART, artistImage: A }, "complete", []],
    [{ coverImage: P, heroImage: P, artistId: ART, artistImage: null }, "missing", ["artist"]],
    [{ coverImage: null, heroImage: null, artistId: null, artistImage: null }, "missing", ["cover", "hero"]],
    [{ coverImage: "eski/yol.jpg", heroImage: P, artistId: null, artistImage: null }, "missing", ["cover"]],
    [{ coverImage: P, heroImage: V, artistId: null, artistImage: null }, "complete", []],
    [{ coverImage: V, heroImage: V, artistId: ART, artistImage: V }, "missing", ["cover", "artist"]],
  ] as const)("imageStatusOf(%o) = %s %o", (i, status, missing) => {
    expect(imageStatusOf(i)).toEqual({ status, missing: [...missing] });
  });

  it("geçersiz yol validImagePath ile null döner", () => {
    expect(validImagePath("logo/00000000-0000-4000-8000-000000000001.webp")).toBeNull();
    expect(validImagePath(P)).toBe(P);
    expect(validImagePath(null)).toBeNull();
  });
});

describe("validHeroPath", () => {
  it("hero için WebP görsel ya da event/ altındaki WebM video kabul edilir", () => {
    expect(validHeroPath(P)).toBe(P);
    expect(validHeroPath(V)).toBe(V);
    expect(validHeroPath("artist/00000000-0000-4000-8000-000000000003.webm")).toBeNull();
    expect(validHeroPath("event/../x.webm")).toBeNull();
    expect(validHeroPath(null)).toBeNull();
  });

  it("validImagePath WebM'i kabul etmez", () => {
    expect(validImagePath(V)).toBeNull();
  });
});
