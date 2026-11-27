import { describe, expect, it } from "vitest";
import { eventFacts, partyOptions, saleModeNote } from "@/components/event/facts";
import { createFakeCore } from "../helpers/fake-core";

describe("eventFacts", () => {
  it("site içeriği dolu etkinlikte beş bilgi sırayla gelir; Kıyafet yazılmaz (yerinde Bilet Al durur)", () => {
    const fake = createFakeCore();
    const ev = fake.addEvent({
      startsAt: "2027-01-15T18:00:00.000Z",
      site: { doorsOpenAt: "2027-01-15T16:30:00.000Z", ageLimit: "18+", dressCode: "Şık" },
    });
    expect(eventFacts(ev)).toEqual([
      { label: "Tarih", value: "15 Ocak 2027 Cuma" },
      { label: "Kapı Açılış", value: "18:30" },
      { label: "Konser Saati", value: "20:00" },
      { label: "Yaş Sınırı", value: "18+" },
      { label: "Başlangıç Fiyatı", value: "1.500,00 ₺ / kişi" },
    ]);
  });

  it("boş alanlar listede yer almaz", () => {
    const fake = createFakeCore();
    expect(eventFacts(fake.addEvent()).map((f) => f.label)).toEqual(["Tarih", "Konser Saati", "Başlangıç Fiyatı"]);
  });

  it.each([
    [12, 12],
    [20, 12],
    [4, 4],
    [0, 1],
  ])("partyOptions(%i) %i seçenek verir", (max, n) => {
    expect(partyOptions(max)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
  });

  it("satış şekli açıklaması kipe göre değişir", () => {
    expect(saleModeNote("seat")).toContain("numaralı sandalye");
    expect(saleModeNote("table")).toContain("bütün olarak");
  });
});
