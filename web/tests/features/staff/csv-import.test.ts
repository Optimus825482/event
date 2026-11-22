import { describe, expect, it } from "vitest";
import {
  foldKey,
  mapColumns,
  parseGender,
  parseImportDate,
  parseShoeSize,
  parseStatus,
  readStaffCsv,
  STAFF_IMPORT_MAX_ROWS,
  StaffCsvError,
} from "@/features/staff/csv-import";
import { CsvError } from "@/features/staff/csv";

describe("başlık eşleme", () => {
  it("eski sistemin başlıkları (satır sonlu ve açıklamalı olanlar dahil) tanınır", () => {
    const map = mapColumns([
      "Sicil No",
      "İsim Soyisim",
      "Unvan",
      "Çalıştığı Bölüm",
      "Görev Yeri ",
      "Miçolar",
      "Kan Grubu",
      "Cinsiyet",
      "Ayakkabı \nNumarası",
      "Kadın Çorap Bedenleri",
      "Doğum Tarihi\n(Ay-Gün-Yıl)",
      "İşe Giriş Tarihi\n(Ay-Gün-Yıl)",
      "Ayrılma Tarihi",
      "Ayrılma \nNedeni ",
      "Durum",
      "Yaş",
    ]);
    expect(map.byIndex).toEqual([
      "sicilNo",
      "fullName",
      "position",
      "department",
      "workLocation",
      "mentor",
      "bloodType",
      "gender",
      "shoeSize",
      "sockSize",
      "birthDate",
      "hireDate",
      "terminationDate",
      "terminationReason",
      "status",
      null,
    ]);
    expect(map.ignored).toEqual(["Yaş"]);
    expect(map.missing).toEqual([]);
  });

  it("büyük harf ve ASCII yazımlar eşleşir", () => {
    expect(mapColumns(["SİCİL NO", "ISIM SOYISIM", "calistigi bolum"]).byIndex).toEqual([
      "sicilNo",
      "fullName",
      "department",
    ]);
    expect(foldKey("  ÇALIŞTIĞI   Bölüm ")).toBe("calistigi bolum");
  });

  it("zorunlu sütun eksikliği ve aynı alana iki sütun raporlanır", () => {
    expect(mapColumns(["Ad Soyad"]).missing).toEqual(["sicilNo"]);
    expect(mapColumns(["Sicil No", "Sicil", "Ad Soyad"]).conflicts).toEqual(["Sicil"]);
  });
});

describe("değer dönüştürücüler", () => {
  it("tarihler: ISO, GG.AA.YYYY, Türkçe ay adı; iki haneli yıl", () => {
    expect(parseImportDate("1990-03-25")).toEqual({ ok: true, value: "1990-03-25" });
    expect(parseImportDate("25.03.1990")).toEqual({ ok: true, value: "1990-03-25" });
    expect(parseImportDate("5.3.1990")).toEqual({ ok: true, value: "1990-03-05" });
    expect(parseImportDate("15 Ocak 1990")).toEqual({ ok: true, value: "1990-01-15" });
    expect(parseImportDate("1 ŞUBAT 2001")).toEqual({ ok: true, value: "2001-02-01" });
    expect(parseImportDate("3 Ağustos 85")).toEqual({ ok: true, value: "1985-08-03" });
    expect(parseImportDate("3.8.25")).toEqual({ ok: true, value: "2025-08-03" });
    expect(parseImportDate("  ")).toEqual({ ok: true, value: null });
  });

  it("belirsiz ya da geçersiz tarihler reddedilir (sessizce yanlış okunmaz)", () => {
    for (const value of ["03/04/1990", "03-04-1990", "31.02.2020", "2020-13-01", "15 Ocaq 1990", "dün"]) {
      expect(parseImportDate(value).ok).toBe(false);
    }
  });

  it("cinsiyet, ayakkabı numarası, durum", () => {
    expect(parseGender("Erkek")).toEqual({ ok: true, value: "male" });
    expect(parseGender("KADIN")).toEqual({ ok: true, value: "female" });
    expect(parseGender("")).toEqual({ ok: true, value: null });
    expect(parseGender("diğer").ok).toBe(false);
    expect(parseShoeSize(" 42 ")).toEqual({ ok: true, value: 42 });
    expect(parseShoeSize("42.5").ok).toBe(false);
    expect(parseShoeSize("")).toEqual({ ok: true, value: null });
    expect(parseStatus("Çalışıyor")).toEqual({ ok: true, value: "active" });
    expect(parseStatus("")).toEqual({ ok: true, value: "active" });
    expect(parseStatus("AYRILDI")).toEqual({ ok: true, value: "terminated" });
    expect(parseStatus("Pasif")).toEqual({ ok: true, value: "inactive" });
    expect(parseStatus("izinde").ok).toBe(false);
  });
});

describe("readStaffCsv", () => {
  it("satırları taslağa çevirir; hücre hataları satıra yazılır", () => {
    const csv = readStaffCsv(
      "﻿Sicil No;İsim Soyisim;Cinsiyet;Ayakkabı Numarası;Doğum Tarihi;Yaş\n" +
        "1001;Çağla Şen;Kadın;38;12.05.1995;29\n" +
        "1002;Ömer Ünal;?;kırk;03/04/1990;\n",
    );
    expect(csv.columns.ignored).toEqual(["Yaş"]);
    expect(csv.rows[0]).toMatchObject({
      line: 2,
      errors: [],
      draft: { sicilNo: "1001", fullName: "Çağla Şen", gender: "female", shoeSize: 38, birthDate: "1995-05-12", status: "active" },
    });
    expect(csv.rows[1]?.errors).toHaveLength(3);
    expect(csv.rows[1]?.errors.join(" ")).toMatch(/Cinsiyet.*Ayakkabı Numarası.*Doğum Tarihi/);
  });

  it("başlıksız sütunda veri satır hatasıdır; adsız boş sütunlar sorun değildir", () => {
    const csv = readStaffCsv("Sicil No;İsim Soyisim;;\n1;Ali;;\n2;Veli;x;\n3;Can;;;fazla");
    expect(csv.rows.map((r) => r.errors.length)).toEqual([0, 1, 1]);
    expect(csv.rows[2]?.errors[0]).toContain("5. sütun");
  });

  it("dosya düzeyi hatalar fırlatılır", () => {
    expect(() => readStaffCsv("Ad Soyad\nAli")).toThrow(StaffCsvError);
    expect(() => readStaffCsv("Sicil No;İsim Soyisim\n")).toThrow(/veri satırı yok/);
    expect(() => readStaffCsv('Sicil No;İsim Soyisim\n1;"Ali')).toThrow(CsvError);
    const tooMany = ["Sicil No;İsim Soyisim", ...Array.from({ length: STAFF_IMPORT_MAX_ROWS + 1 }, (_, i) => `${i};Ad ${i}`)];
    expect(() => readStaffCsv(tooMany.join("\n"))).toThrow(/En fazla 500/);
    const exact = tooMany.slice(0, STAFF_IMPORT_MAX_ROWS + 1);
    expect(readStaffCsv(exact.join("\n")).rows).toHaveLength(STAFF_IMPORT_MAX_ROWS);
  });

  it("virgül ayırıcılı, tırnaklı dosya", () => {
    const csv = readStaffCsv('Sicil No,İsim Soyisim,Unvan\n"0042","Yılmaz, Ayşe","Şef ""Kıdemli"""\n');
    expect(csv.rows[0]?.draft).toMatchObject({ sicilNo: "0042", fullName: "Yılmaz, Ayşe", position: 'Şef "Kıdemli"' });
  });
});
