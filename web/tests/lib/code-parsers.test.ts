import { describe, expect, it } from "vitest";
import { parseBookingCode, parsePnr } from "@/lib/code-format";
import { joinFullName } from "@/lib/full-name";

describe("parseBookingCode", () => {
  it("R + 6 karakteri boşluk, tire ve küçük harfe bakmadan kabul eder", () => {
    expect(parseBookingCode("rabc-def")).toBe("RABCDEF");
    expect(parseBookingCode(" R234 567 ")).toBe("R234567");
  });

  it("R ile başlamayan, yanlış uzunlukta ya da alfabe dışı girdiyi reddeder", () => {
    expect(parseBookingCode("ABCDEFG")).toBeNull();
    expect(parseBookingCode("RABCDE")).toBeNull();
    expect(parseBookingCode("RABCDE0")).toBeNull();
  });

  it("8 karakterlik PNR rezervasyon kodu sayılmaz", () => {
    expect(parseBookingCode("RABCDEFG")).toBeNull();
    expect(parsePnr("RABCDEFG")).toBe("RABCDEFG");
  });
});

describe("joinFullName", () => {
  it("kırpar, boş parçaları atar ve tek boşlukla birleştirir", () => {
    expect(joinFullName("  Ayşe ", " Kaya  ")).toBe("Ayşe Kaya");
    expect(joinFullName("Ayşe", "   ")).toBe("Ayşe");
    expect(joinFullName(null, "Kaya")).toBe("Kaya");
    expect(joinFullName("  ", undefined)).toBe("");
  });
});
