import { describe, expect, it } from "vitest";
import { CsvError, detectDelimiter, parseCsv } from "@/features/staff/csv";

function cells(text: string): string[][] {
  return parseCsv(text).rows.map((r) => r.cells);
}

describe("CSV ayrıştırıcı", () => {
  it("noktalı virgül ve virgül ayırıcılarını başlıktan algılar", () => {
    expect(detectDelimiter("Sicil No;İsim Soyisim\n1;Ali, Veli")).toBe(";");
    expect(detectDelimiter("Sicil No,İsim Soyisim\n1,Ali")).toBe(",");
    // Tırnak içindeki ayırıcı sayılmaz.
    expect(detectDelimiter('"Ad, Soyad";Sicil\n')).toBe(";");
    expect(detectDelimiter('"Ad; Soyad",Sicil\n')).toBe(",");
    expect(detectDelimiter("Tek")).toBe(",");
    expect(detectDelimiter("a;b,c")).toBe(";");
  });

  it("başlık ve satırları okur; satır numaraları fiziksel satırdır", () => {
    const result = parseCsv("Sicil No;İsim Soyisim\n1001;Ahmet Yılmaz\n1002;Mehmet Kaya\n");
    expect(result.delimiter).toBe(";");
    expect(result.headers).toEqual(["Sicil No", "İsim Soyisim"]);
    expect(result.rows).toEqual([
      { line: 2, cells: ["1001", "Ahmet Yılmaz"] },
      { line: 3, cells: ["1002", "Mehmet Kaya"] },
    ]);
  });

  it("UTF-8 BOM atılır, CRLF ve yalnız CR satır sonları desteklenir", () => {
    expect(parseCsv("﻿Sicil;Ad\r\n1;Ali\r\n").headers).toEqual(["Sicil", "Ad"]);
    expect(cells("﻿Sicil;Ad\r\n1;Ali\r\n")).toEqual([["1", "Ali"]]);
    expect(cells("Sicil;Ad\r1;Ali\r2;Veli")).toEqual([
      ["1", "Ali"],
      ["2", "Veli"],
    ]);
  });

  it("tırnaklı alanlar: ayırıcı, kaçışlı tırnak ve satır sonu içerebilir", () => {
    const text = 'Sicil;Ad;Not\n1;"Yılmaz; Ahmet";"Dedi ki ""merhaba"""\n2;"Çok\nsatırlı";x\n3;Son;y';
    const result = parseCsv(text);
    expect(result.rows.map((r) => r.cells)).toEqual([
      ["1", "Yılmaz; Ahmet", 'Dedi ki "merhaba"'],
      ["2", "Çok\nsatırlı", "x"],
      ["3", "Son", "y"],
    ]);
    // Çok satırlı kayıttan sonraki satır numarası doğru ilerler.
    expect(result.rows.map((r) => r.line)).toEqual([2, 3, 5]);
  });

  it("tırnak içindeki CRLF korunur", () => {
    expect(cells('A,B\n"x\r\ny",z')).toEqual([["x\r\ny", "z"]]);
  });

  it("boş tırnaklı alan boş dizgedir; sondaki ayırıcı boş hücre üretir", () => {
    expect(cells('A;B;C\n"";x;\n')).toEqual([["", "x", ""]]);
  });

  it("Türkçe karakterler ve NFC/NFD olduğu gibi korunur (hiçbir şey kırpılmaz)", () => {
    const nfd = "Şükrü";
    expect(cells(`Ad;Unvan\nÇağrı Öztürk;  Şef Garson  \n${nfd};İĞÜŞÖÇ ığüşöç`)).toEqual([
      ["Çağrı Öztürk", "  Şef Garson  "],
      [nfd, "İĞÜŞÖÇ ığüşöç"],
    ]);
  });

  it("boş satırlar ve yalnızca ayırıcıdan oluşan satırlar atlanır ve sayılır", () => {
    const result = parseCsv("\n\nSicil;Ad\n1;Ali\n\n;;\n  ;  \n2;Veli\n\n");
    expect(result.headers).toEqual(["Sicil", "Ad"]);
    expect(result.rows.map((r) => r.cells)).toEqual([
      ["1", "Ali"],
      ["2", "Veli"],
    ]);
    expect(result.rows.map((r) => r.line)).toEqual([4, 8]);
    // Satır 5, 6, 7 ve sondaki ikinci satır sonu (satır 9); baştaki boş satırlar başlıktan öncedir.
    expect(result.emptyRows).toBe(4);
  });

  it("formül benzeri değerler (=, +, -, @) içe aktarmada olduğu gibi kalır", () => {
    expect(cells('A;B\n=1+2;"@SUM(A1)"\n-5;+90')).toEqual([
      ["=1+2", "@SUM(A1)"],
      ["-5", "+90"],
    ]);
  });

  it("tırnaksız hücredeki tırnak korunur", () => {
    expect(cells('A;B\n12" ekran;x')).toEqual([['12" ekran', "x"]]);
  });

  it("kapanmamış tırnak satır numarasıyla hata verir", () => {
    expect(() => parseCsv('A;B\n1;"açık\n2;x')).toThrow(CsvError);
    expect(() => parseCsv('A;B\n1;"açık\n2;x')).toThrow(/Satır 2/);
  });

  it("kapanan tırnaktan sonra ayırıcı dışı karakter hata verir", () => {
    expect(() => parseCsv('A;B\n"ab"c;x')).toThrow(/Satır 2/);
  });

  it("boş dosya ve yinelenen başlık hata verir; adsız başlık sütunu boş ad alır", () => {
    expect(() => parseCsv("")).toThrow(/başlık/);
    expect(() => parseCsv("﻿\n\n")).toThrow(/başlık/);
    expect(() => parseCsv("Ad;ad\n1;2")).toThrow(/yinelenen/);
    expect(parseCsv("Ad;;\nAli;;").headers).toEqual(["Ad", "", ""]);
  });

  it("başlık adları kırpılır; tırnak içi satır sonu başlıkta korunur", () => {
    expect(parseCsv(' Sicil No ;"Ayakkabı \nNumarası"\n1;42').headers).toEqual(["Sicil No", "Ayakkabı \nNumarası"]);
  });

  it("yalnızca başlık varsa satır listesi boştur", () => {
    expect(parseCsv("Sicil;Ad\n").rows).toEqual([]);
  });
});
