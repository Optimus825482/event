import { describe, expect, it } from "vitest";
import { eventHeroMedia } from "@/components/event/hero-media";

const HERO = "event/11111111-1111-4111-8111-111111111111.webp";
const COVER = "event/22222222-2222-4222-8222-222222222222.webp";
const ARTIST = "artist/33333333-3333-4333-8333-333333333333.webp";

const input = (o: { hero?: string | null; cover?: string | null; artist?: string | null }) => ({
  coverImage: o.cover ?? null,
  artistImage: o.artist ?? null,
  site: { heroImage: o.hero ?? null },
});

describe("etkinlik üst görseli", () => {
  it("hareketli tanıtım görseli gösterilir; azaltılmış harekette kapak görseli", () => {
    expect(eventHeroMedia(input({ hero: HERO, cover: COVER, artist: ARTIST }))).toEqual({
      src: `/api/gorsel/${HERO}`,
      stillSrc: `/api/gorsel/${COVER}`,
    });
  });

  it("kapak yoksa sabit görsel sanatçı görselidir", () => {
    expect(eventHeroMedia(input({ hero: HERO, artist: ARTIST }))).toEqual({
      src: `/api/gorsel/${HERO}`,
      stillSrc: `/api/gorsel/${ARTIST}`,
    });
  });

  it("tanıtım görseli yoksa kapak tek başına gösterilir", () => {
    expect(eventHeroMedia(input({ cover: COVER, artist: ARTIST }))).toEqual({
      src: `/api/gorsel/${COVER}`,
      stillSrc: null,
    });
  });

  it("hiç görsel yoksa ikisi de boştur", () => {
    expect(eventHeroMedia(input({}))).toEqual({ src: null, stillSrc: null });
  });

  it("geçersiz yol görsel rotasına çevrilmez", () => {
    expect(eventHeroMedia(input({ hero: "../gizli.webp", cover: COVER }))).toEqual({
      src: `/api/gorsel/${COVER}`,
      stillSrc: null,
    });
  });
});
