import { describe, expect, it } from "vitest";
import { mapHeaders, normalizeHeader } from "@/features/import/headers";
import { MAX_DATA_ROWS, MAX_FILE_BYTES } from "@/features/import/limits";
import { readFirstSheet } from "@/features/import/xlsx-reader";
import { RESERVATION_COLUMNS } from "@/features/import/columns";
import { expectDomain, xlsx } from "./helpers";

describe("başlık eşleme", () => {
  it("büyük/küçük harf, aksan, boşluk ve noktalamayı yok sayar", () => {
    expect(normalizeHeader("  MASA  Etiketi ")).toBe("masaetiketi");
    expect(normalizeHeader("masa_etiketi")).toBe("masaetiketi");
    expect(normalizeHeader("Kişi Sayısı")).toBe("kisisayisi");
    expect(normalizeHeader("KİŞİ SAYISI")).toBe("kisisayisi");
    expect(normalizeHeader("E-posta")).toBe("eposta");
  });

  it("Türkçe ve İngilizce takma adları aynı alana eşler", () => {
    const map = mapHeaders(["Table", "Guest Name", "GSM", "E-Mail", "Pax", "Notes"], RESERVATION_COLUMNS);
    expect([...map.entries()]).toEqual([
      ["tableLabel", 0],
      ["guestName", 1],
      ["guestPhone", 2],
      ["guestEmail", 3],
      ["guestCount", 4],
      ["note", 5],
    ]);
  });

  it("zorunlu başlık yoksa beklenen başlıkları listeleyen invalid hatası verir", async () => {
    const err = await expectDomain(
      Promise.resolve().then(() => mapHeaders(["Masa", "Telefon"], RESERVATION_COLUMNS)),
      "invalid",
      /Eksik başlık: Misafir adı; Kişi sayısı\. Beklenen başlıklar: Masa etiketi \(zorunlu\), Misafir adı \(zorunlu\)/,
    );
    expect(err.message).toContain("Kişi sayısı (zorunlu)");
  });
});

describe("readFirstSheet", () => {
  it("ilk sayfayı okur, boş satırları atlar, satır numaralarını korur", async () => {
    const bytes = await xlsx(
      [["Masa", "Ad"], ["A1", "Ali"], [null, null], ["A2", "Veli"]],
      [["başka", "sayfa"], ["x", "y"]],
    );
    const sheet = await readFirstSheet(bytes);
    expect(sheet.headers).toEqual(["Masa", "Ad"]);
    expect(sheet.rows).toEqual([
      { row: 2, cells: ["A1", "Ali"] },
      { row: 4, cells: ["A2", "Veli"] },
    ]);
  });

  it("formülleri değerlendirmez, saklanan sonucu okur", async () => {
    const bytes = await xlsx([["Masa", "Ad"], ["A1", { formula: 'CONCATENATE("x","y")', result: "ÖNBELLEK" }]]);
    const sheet = await readFirstSheet(bytes);
    expect(sheet.rows[0]?.cells[1]).toBe("ÖNBELLEK");
  });

  it("hücre metnini kırpar ve uzunluğunu sınırlar", async () => {
    const sheet = await readFirstSheet(await xlsx([["Masa", "Not"], ["  A1  ", "x".repeat(2000)]]));
    expect(sheet.rows[0]?.cells[0]).toBe("A1");
    expect(sheet.rows[0]?.cells[1]).toHaveLength(500);
  });

  it("10 MB üstü dosyayı reddeder", async () => {
    const big = new Uint8Array(MAX_FILE_BYTES + 1);
    big.set([0x50, 0x4b, 0x03, 0x04]);
    await expectDomain(readFirstSheet(big), "invalid", /10 MB/);
  });

  it(".xlsx adlı ama ZIP olmayan baytları reddeder", async () => {
    const text = new TextEncoder().encode("Masa,Ad\nA1,Ali\n");
    await expectDomain(readFirstSheet(text), "invalid", "Yalnızca .xlsx dosyaları kabul edilir");
  });

  it("ZIP imzalı ama bozuk dosyayı açık bir invalid hatasıyla reddeder", async () => {
    const bytes = new Uint8Array(500).fill(7);
    bytes.set([0x50, 0x4b, 0x03, 0x04]);
    await expectDomain(readFirstSheet(bytes), "invalid", "Dosya geçerli bir .xlsx çalışma kitabı değil");
  });

  it("sıkıştırma bombası: ZIP başlığı çok büyük açılmış boyut bildirirse açmadan reddedilir", async () => {
    const bytes = await xlsx([["Masa", "Ad"], ["A1", "Ali"]]);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let patched = 0;
    for (let i = 0; i < bytes.length - 46; i += 1) {
      if (view.getUint32(i, true) === 0x02014b50) {
        view.setUint32(i + 24, 200 * 1024 * 1024, true);
        patched += 1;
        break;
      }
    }
    expect(patched).toBe(1);
    await expectDomain(readFirstSheet(bytes), "invalid", /izin verilenden çok büyük/);
  });

  it("boş dosya ve yalnızca başlıklı dosya reddedilir", async () => {
    await expectDomain(readFirstSheet(new Uint8Array(0)), "invalid", "Dosya boş");
    await expectDomain(readFirstSheet(await xlsx([["Masa", "Ad"]])), "invalid", "Dosyada veri satırı yok");
  });

  it("5000 veri satırını kabul eder, 5001'i reddeder", async () => {
    const make = (n: number) => xlsx([["Masa", "Ad"], ...Array.from({ length: n }, (_, i) => [`M${i}`, "x"])]);
    const ok = await readFirstSheet(await make(MAX_DATA_ROWS));
    expect(ok.rows).toHaveLength(MAX_DATA_ROWS);
    await expectDomain(readFirstSheet(await make(MAX_DATA_ROWS + 1)), "invalid", /5000 veri satırı/);
  }, 60_000);
});
