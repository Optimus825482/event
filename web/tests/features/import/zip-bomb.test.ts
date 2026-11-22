import { describe, expect, it } from "vitest";
import { MAX_UNCOMPRESSED_BYTES } from "@/features/import/limits";
import { readFirstSheet } from "@/features/import/xlsx-reader";
import { expectDomain, xlsx } from "./helpers";
import { buildZip } from "./zip-helper";

const TOO_BIG = /izin verilenden çok büyük/;
const NOT_XLSX = "Dosya geçerli bir .xlsx çalışma kitabı değil";

describe("ZIP bombası: gerçek açılmış bayt sınırı", () => {
  it("merkezi dizinde küçük boyut bildiren ama sınırı aşarak açılan girdiyi reddeder", async () => {
    const zip = buildZip([{ name: "xl/big.xml", data: new Uint8Array(100_000), declaredSize: 10 }]);
    await expectDomain(readFirstSheet(zip, { maxUncompressedBytes: 1000 }), "invalid", TOO_BIG);
  });

  it("varsayılan sınırı (100 MB) aşan sıfır dolu girdiyi küçük bildirimle reddeder", async () => {
    const zip = buildZip([{ name: "xl/big.xml", data: new Uint8Array(MAX_UNCOMPRESSED_BYTES + 1), declaredSize: 5 }]);
    await expectDomain(readFirstSheet(zip), "invalid", TOO_BIG);
  }, 30_000);

  it("girdiler tek tek küçük olsa da gerçek toplam sınırı aşarsa reddeder", async () => {
    const entry = (n: string) => ({ name: n, data: new Uint8Array(600) });
    const zip = buildZip([entry("a"), entry("b")]);
    await expectDomain(readFirstSheet(zip, { maxUncompressedBytes: 1000 }), "invalid", TOO_BIG);
  });

  it("bildirilen boyut gerçek boyuttan farklıysa reddeder", async () => {
    const zip = buildZip([{ name: "a.xml", data: new Uint8Array(500), declaredSize: 400 }]);
    await expectDomain(readFirstSheet(zip), "invalid", NOT_XLSX);
  });

  it("şifreli girdiyi ve desteklenmeyen yöntemi reddeder", async () => {
    const enc = buildZip([{ name: "a.xml", data: new Uint8Array(10), flags: 1 }]);
    await expectDomain(readFirstSheet(enc), "invalid", NOT_XLSX);
    const zip = buildZip([{ name: "a.xml", data: new Uint8Array(10), method: 0 }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    view.setUint16(8, 12, true); // yerel yöntem
    await expectDomain(readFirstSheet(zip), "invalid", NOT_XLSX);
  });

  it("yerel başlık adı merkezi dizindekiyle uyuşmazsa reddeder", async () => {
    const zip = buildZip([{ name: "a.xml", data: new Uint8Array(10) }]);
    zip[30] = 0x62; // yerel başlıktaki ilk ad baytı
    await expectDomain(readFirstSheet(zip), "invalid", NOT_XLSX);
  });

  it("exceljs'in ürettiği normal dosya hâlâ okunur", async () => {
    const sheet = await readFirstSheet(await xlsx([["Masa", "Ad"], ["A1", "Ali"]]));
    expect(sheet.rows).toEqual([{ row: 2, cells: ["A1", "Ali"] }]);
  });
});
