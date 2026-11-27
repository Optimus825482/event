import { describe, expect, it } from "vitest";
import { mapArchiveWriteError } from "@/features/archive/errors";
import { DomainError } from "@/lib/action";

const pg = (code: string, constraint?: string) => Object.assign(new Error("pg"), { code, constraint });
/** drizzle hatayı `cause` zincirine sarar. */
const wrapped = (inner: Error) => Object.assign(new Error("Failed query"), { cause: inner });

describe("arşiv yazım hataları", () => {
  it.each([
    ["40001", undefined, "Etkinlik aynı anda değiştirildi, lütfen tekrar deneyin"],
    ["23503", "event_archives_artist_id_artists_id_fk", "Sanatçı silinmiş, etkinliği güncelleyip tekrar deneyin"],
    ["22003", undefined, "Tutar arşiv sınırını aşıyor"],
  ])("%s → conflict", (code, constraint, message) => {
    for (const error of [pg(code, constraint), wrapped(pg(code, constraint))]) {
      try {
        mapArchiveWriteError(error);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(DomainError);
        expect(e).toMatchObject({ code: "conflict", message });
      }
    }
  });

  it("tanınmayan hata ve başka FK aynen yeniden fırlatılır", () => {
    const other = pg("23503", "orders_event_id_fk");
    expect(() => mapArchiveWriteError(other)).toThrow(other);
    const plain = new Error("x");
    expect(() => mapArchiveWriteError(plain)).toThrow(plain);
  });
});
