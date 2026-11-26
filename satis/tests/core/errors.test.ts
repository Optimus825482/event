import { describe, expect, it } from "vitest";
import { ERROR_MESSAGES, messageFor, type SiteErrorCode } from "@/lib/core/errors";
import { SALES_ERROR_CODES } from "@/lib/core/contract";

describe("hata mesajları", () => {
  it("her sözleşme kodunun boş olmayan Türkçe mesajı vardır", () => {
    for (const code of [...SALES_ERROR_CODES, "core_unreachable"] as const) {
      expect(ERROR_MESSAGES[code].length).toBeGreaterThan(10);
    }
  });

  it.each([
    [{ code: "seats_unavailable", details: { free: 2 } }, "Bu masada yalnızca 2 boş sandalye kaldı."],
    [{ code: "seats_unavailable", details: { free: 0 } }, "Bu masa az önce doldu. Lütfen başka bir masa seçin."],
    [{ code: "whole_table_required", details: { seats: 6 } }, "Bu masa yalnızca bütün olarak (6 kişilik) alınabilir."],
    [{ code: "rate_limited", retryAfterSeconds: 130 }, "Çok fazla deneme yapıldı. 3 dakika sonra tekrar deneyin."],
    [{ code: "rate_limited" }, "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin."],
    [{ code: "hold_expired" }, "Süreniz doldu. Masayı yeniden seçmeniz gerekiyor."],
  ] as const)("messageFor(%o) = %s", (err, out) => {
    expect(messageFor(err as { code: SiteErrorCode })).toBe(out);
  });
});
