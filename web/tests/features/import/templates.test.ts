import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { mapHeaders } from "@/features/import/headers";
import { ASSIGNMENT_COLUMNS, RESERVATION_COLUMNS } from "@/features/import/columns";
import { buildAssignmentTemplate, buildReservationTemplate } from "@/features/import/templates";
import { expectDomain } from "./helpers";
import { readFirstSheet } from "@/features/import/xlsx-reader";

async function firstSheetHeaders(bytes: Uint8Array): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  return (sheet?.getRow(1).values as (string | undefined)[]).slice(1).map(String);
}

describe("şablonlar", () => {
  it("rezervasyon şablonunun başlıkları içe aktarmanın beklediği başlıklardır", async () => {
    const bytes = await buildReservationTemplate();
    const headers = await firstSheetHeaders(bytes);
    expect(headers).toEqual(["Masa etiketi", "Misafir adı", "Telefon", "E-posta", "Kişi sayısı", "Not"]);
    expect(() => mapHeaders(headers, RESERVATION_COLUMNS)).not.toThrow();
  });

  it("atama şablonunun başlıkları kabul edilir; boş şablon 'veri satırı yok' diye reddedilir", async () => {
    const bytes = await buildAssignmentTemplate();
    const headers = await firstSheetHeaders(bytes);
    expect(() => mapHeaders(headers, ASSIGNMENT_COLUMNS)).not.toThrow();
    await expectDomain(readFirstSheet(bytes), "invalid", "Dosyada veri satırı yok");
  });
});
