import { describe, expect, it } from "vitest";
import { nextIndex, shouldAutoAdvance, toHeroSlides } from "@/components/home/slides";
import type { EventCard as EventCardData } from "@/lib/core/contract";
import { FAKE_IMAGES } from "../helpers/fake-core";

const ev = (i: number, o: Partial<EventCardData> = {}): EventCardData => ({
  id: `e${i}`,
  name: `E${i}`,
  startsAt: `2027-01-${10 + i}T18:00:00.000Z`,
  endsAt: null,
  artistName: null,
  eventType: null,
  currency: "TRY",
  minPrice: "1500.00",
  saleState: "open",
  coverImage: null,
  artistImage: null,
  isDemo: false,
  ...o,
});

describe("slides", () => {
  it("en çok dört slayt üretir ve sırayı korur", () => {
    expect(toHeroSlides([1, 2, 3, 4, 5].map((i) => ev(i))).map((s) => s.id)).toEqual(["e1", "e2", "e3", "e4"]);
  });

  it("slayt görseli önce sanatçı, sonra kapak; ikisi de yoksa null", () => {
    expect(toHeroSlides([ev(1, { artistImage: FAKE_IMAGES.artist, coverImage: FAKE_IMAGES.cover })])[0]!.image).toBe(
      `/api/gorsel/${FAKE_IMAGES.artist}`,
    );
    expect(toHeroSlides([ev(1, { coverImage: FAKE_IMAGES.cover })])[0]!.image).toBe(
      `/api/gorsel/${FAKE_IMAGES.cover}`,
    );
    expect(toHeroSlides([ev(1)])[0]!.image).toBeNull();
  });

  it("yönetimdeki tanıtım videosunu ve sabit afişini birlikte sunar", () => {
    const [slide] = toHeroSlides([ev(1, { heroImage: FAKE_IMAGES.heroVideo, coverImage: FAKE_IMAGES.cover })]);
    expect(slide).toMatchObject({
      motion: `/api/gorsel/${FAKE_IMAGES.heroVideo}`,
      image: `/api/gorsel/${FAKE_IMAGES.cover}`,
    });
  });

  it("etiketler sunucuda Kıbrıs saatiyle hazırlanır", () => {
    expect(toHeroSlides([ev(5, { saleState: "closed" })])[0]).toMatchObject({
      dateLabel: "15 Ocak 2027 Cuma",
      timeLabel: "20:00",
      priceLabel: "1.500,00 ₺",
      open: false,
      stateLabel: "Satış kapalı",
    });
  });

  it.each([
    [0, 4, 1, 1],
    [3, 4, 1, 0],
    [0, 4, -1, 3],
  ] as const)("nextIndex(%i, %i, %i) = %i", (c, n, s, out) => {
    expect(nextIndex(c, n, s)).toBe(out);
  });

  it.each([
    [{ slideCount: 4, reducedMotion: false, paused: false }, true],
    [{ slideCount: 4, reducedMotion: true, paused: false }, false],
    [{ slideCount: 4, reducedMotion: false, paused: true }, false],
    [{ slideCount: 1, reducedMotion: false, paused: false }, false],
  ])("shouldAutoAdvance(%o) = %s", (i, out) => {
    expect(shouldAutoAdvance(i)).toBe(out);
  });
});
