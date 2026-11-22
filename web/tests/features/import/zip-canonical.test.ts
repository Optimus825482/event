import { describe, expect, it } from "vitest";
import { readFirstSheet } from "@/features/import/xlsx-reader";
import { expectDomain, xlsx } from "./helpers";
import { buildZip } from "./zip-helper";

const NOT_XLSX = "Dosya geçerli bir .xlsx çalışma kitabı değil";

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

describe("ZIP kanonikleştirme: doğrulanan ile açılan aynı olmalı", () => {
  it("EOCD yorumuna gizlenmiş ikinci dizin+EOCD reddedilir", async () => {
    const real = buildZip([{ name: "a.xml", data: new Uint8Array(10) }]);
    const hidden = buildZip([{ name: "b.xml", data: new Uint8Array(10) }]);
    // Gerçek EOCD'nin yorum alanını hidden arşiv olarak ayarla.
    const withComment = concat(real, hidden);
    new DataView(withComment.buffer).setUint16(real.length - 2, hidden.length, true);
    await expectDomain(readFirstSheet(withComment), "invalid", NOT_XLSX);
  });

  it("gerçek EOCD'den sonra eklenmiş ikinci arşiv/artık baytlar reddedilir", async () => {
    const real = buildZip([{ name: "a.xml", data: new Uint8Array(10) }]);
    const other = buildZip([{ name: "b.xml", data: new Uint8Array(10) }]);
    await expectDomain(readFirstSheet(concat(real, other)), "invalid", NOT_XLSX);
    await expectDomain(readFirstSheet(concat(real, new Uint8Array(3))), "invalid", NOT_XLSX);
  });

  it("dizin boyutu EOCD'dekiyle uyuşmazsa reddedilir", async () => {
    const zip = buildZip([{ name: "a.xml", data: new Uint8Array(10) }]);
    new DataView(zip.buffer).setUint32(zip.length - 22 + 12, 5, true);
    await expectDomain(readFirstSheet(zip), "invalid", NOT_XLSX);
  });

  it("yinelenen ve güvensiz adlar reddedilir", async () => {
    const dup = buildZip([
      { name: "a.xml", data: new Uint8Array(1) },
      { name: "a.xml", data: new Uint8Array(2) },
    ]);
    await expectDomain(readFirstSheet(dup), "invalid", NOT_XLSX);
    for (const name of ["../evil.xml", "/abs.xml", "a\\b.xml"]) {
      await expectDomain(readFirstSheet(buildZip([{ name, data: new Uint8Array(1) }])), "invalid", NOT_XLSX);
    }
  });

  it("normal exceljs çalışma kitabı yeniden kurulan arşivden aynı satırları verir", async () => {
    const sheet = await readFirstSheet(await xlsx([["Masa", "Ad"], ["A1", "Ali"], ["A2", "Ayşe"]]));
    expect(sheet.headers).toEqual(["Masa", "Ad"]);
    expect(sheet.rows).toEqual([
      { row: 2, cells: ["A1", "Ali"] },
      { row: 3, cells: ["A2", "Ayşe"] },
    ]);
  });
});
