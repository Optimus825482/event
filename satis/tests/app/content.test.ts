import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ABOUT } from "@/content/about";
import { FAQ } from "@/content/faq";
import { REFUND_CLAUSES } from "@/content/refund";
import { SOCIAL_LINKS } from "@/content/social";

const CONTENT_DIR = resolve(import.meta.dirname, "../../src/content");

describe("sabit içerik", () => {
  it("SSS dokuz sorudur ve yeni satış modelini anlatır", () => {
    expect(FAQ).toHaveLength(9);
    const all = FAQ.map((f) => f.a).join(" ");
    expect(all).toContain("numaralı sandalyelerinizi tek tek seçersiniz");
    expect(all).not.toContain("otomatik olarak grubunuz için ayrılır");
    expect(all).not.toMatch(/3B salonda|ME7K2Q/);
  });

  it("etkinliğe göre değişen bilgiler sabit yazılmaz", () => {
    const a = (q: string) => FAQ.find((f) => f.q === q)!.a;
    for (const q of ["Yaş sınırı var mı?", "Kıyafet kuralı nedir?", "Kapı açılış ve gala yemeği saatleri nasıldır?"]) {
      expect(a(q)).toContain("etkinlik sayfasında");
      expect(a(q)).not.toMatch(/18|20:00|22:00/);
    }
  });

  it("iade maddeleri beştir; KVKK maddesi alınmaz", () => {
    expect(REFUND_CLAUSES.map((c) => c.title[0])).toEqual(["1", "2", "3", "4", "5"]);
    expect(JSON.stringify(REFUND_CLAUSES)).not.toContain("6698");
  });

  it("hakkımızda üç kart taşır", () => {
    expect(ABOUT.cards.map((c) => c.title)).toEqual([
      "Modern Organizasyon Alanları",
      "Ses, Işık & Sahne Teknolojisi",
      "Seçkin Misafir Deneyimi",
    ]);
  });

  it("içerik dosyalarında dil anahtarı, dış bağlantı ve prototip dosya adı kalmaz", () => {
    // Dış bağlantılar yalnızca sosyal medya dosyasında tutulur; o dosya aşağıdaki testle sınırlanır.
    const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".ts"));
    for (const f of files) {
      const text = readFileSync(resolve(CONTENT_DIR, f), "utf8");
      expect(text).not.toContain("data-i18n");
      expect(text).not.toContain(".html");
      expect(text).not.toContain("http://");
      if (f !== "social.ts") expect(text).not.toContain("https://");
    }
  });

  it("sosyal medya adresleri yalnızca prototiplerde bulunan gerçek hesaplardır; olmayanlar boştur", () => {
    expect(Object.fromEntries(SOCIAL_LINKS.map((s) => [s.network, s.url]))).toEqual({
      instagram: "https://www.instagram.com/merit.entertainment/",
      facebook: "https://www.facebook.com/meritentertainment/",
      youtube: "",
      tiktok: "",
      x: "",
      whatsapp: "",
      website: "https://www.merithotels.com/konserler",
    });
  });
});
