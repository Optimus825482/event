import { afterEach, describe, expect, it, vi } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { logError } from "@/lib/log";

function capture(run: () => void): string {
  const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    run();
    return write.mock.calls.map((call) => String(call[0])).join("");
  } finally {
    write.mockRestore();
  }
}

afterEach(() => vi.restoreAllMocks());

describe("logError", () => {
  it("sıradan hatalarda ad, ileti ve yığını yazar", () => {
    const out = capture(() => logError("test", new Error("beklenmedik durum")));
    const entry = JSON.parse(out);
    expect(entry).toMatchObject({ level: "error", scope: "test", name: "Error", message: "beklenmedik durum" });
    expect(entry.stack).toContain("beklenmedik durum");
  });

  it("Drizzle sorgu hatasında parametreleri (kişisel veri, parola özeti) hiçbir alanda yazmaz", () => {
    const secrets = ["+905551112233", "ayse@example.com", "$2b$10$abcdefghijklmnopqrstuv", "Ayşe Yılmaz"];
    const cause = Object.assign(new Error('duplicate key value violates unique constraint "customers_phone_uq"'), {
      code: "23505",
      severity: "ERROR",
      routine: "_bt_check_unique",
      detail: `Key (phone)=(${secrets[0]}) already exists.`,
      constraint: "customers_phone_uq",
      table: "customers",
    });
    const error = new DrizzleQueryError(
      'insert into "customers" ("phone", "email", "name") values ($1, $2, $3)',
      secrets.slice(0, 3).concat(secrets[3] ?? ""),
      cause,
    );

    const out = capture(() => logError("action:customers.create", error));
    for (const secret of secrets) expect(out).not.toContain(secret);

    const entry = JSON.parse(out);
    expect(entry.query).toBe('insert into "customers" ("phone", "email", "name") values ($1, $2, $3)');
    expect(entry.cause).toMatchObject({ code: "23505", constraint: "customers_phone_uq", table: "customers" });
    expect(entry.cause.message).toBeUndefined();
    expect(entry.message).toBeUndefined();
    expect(entry.stack).toContain("at ");
  });

  it("pg veritabanı hatasının ayrıntı ve iletisini (değer içerebilir) yazmaz", () => {
    const pgError = Object.assign(new Error('invalid input syntax for type uuid: "ayse@example.com"'), {
      code: "22P02",
      severity: "ERROR",
      routine: "string_to_uuid",
    });
    const out = capture(() => logError("test", pgError));
    expect(out).not.toContain("ayse@example.com");
    expect(JSON.parse(out)).toMatchObject({ code: "22P02" });
  });
});
