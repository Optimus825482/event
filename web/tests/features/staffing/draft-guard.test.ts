import { describe, expect, it } from "vitest";
import { DRAFT_DIRTY_NOTE, draftWriteBlock } from "@/features/staffing/draft-guard";

describe("taslak koruması (sunucuya doğrudan yazan düğmeler)", () => {
  it("kaydedilmemiş taslak varsa engeller ve Türkçe not verir", () => {
    expect(draftWriteBlock(true)).toEqual({ blocked: true, note: DRAFT_DIRTY_NOTE });
    expect(DRAFT_DIRTY_NOTE).toContain("kaydedin");
  });

  it("taslak temizse engellemez", () => {
    expect(draftWriteBlock(false)).toEqual({ blocked: false, note: null });
  });
});
