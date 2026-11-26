import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { FIND_TABLE_MISMATCH, submitFindTable } from "@/features/find-table/submit";
import type { FindTableLimiters } from "@/features/find-table/rate-limit";
import { verifyFindTableToken } from "@/features/find-table/token";
import { truncateAll } from "../../helpers/db";
import { ticketedEvent } from "../../helpers/door";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- imza anahtar parametresini taşısın diye
const allow = () => ({ check: vi.fn(async (_key: string) => ({ allowed: true as const })) });
const limiters = () => ({ ip: allow(), code: allow() });
const h = (ip: string) => new Headers({ "x-real-ip": ip, "x-forwarded-for": "198.51.100.9" });
const deps = (l: FindTableLimiters) => ({ limiters: l, trustedHeader: "x-real-ip" });

describe("masa arama gönderimi", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("doğru bilgi found döner", async () => {
    const te = await ticketedEvent();
    const out = await submitFindTable(db, { code: te.order.pnr, lastName: "Yılmaz" }, h("203.0.113.7"), deps(limiters()));
    expect(out.kind).toBe("found");
    if (out.kind === "found") expect(verifyFindTableToken(out.token)?.kind).toBe("order");
  });

  it.each([["pnr", "Kaya"], ["ZZZZZZZZ", "Yılmaz"], ["", ""], [undefined, null], ["pnr", ""]])(
    "eşleşmeyen girdi (%s, %s) mismatch döner",
    async (code, lastName) => {
      const te = await ticketedEvent();
      const real = code === "pnr" ? te.order.pnr : code;
      const out = await submitFindTable(db, { code: real, lastName }, h("203.0.113.7"), deps(limiters()));
      expect(out).toEqual({ kind: "mismatch" });
    },
  );

  it("hız sınırı limited ve bekleme süresini döner", async () => {
    const l: FindTableLimiters = {
      ip: { check: async () => ({ allowed: false as const, retryAfterSeconds: 120 }) },
      code: allow(),
    };
    expect(await submitFindTable(db, { code: "X", lastName: "Y" }, h("203.0.113.7"), deps(l))).toEqual({
      kind: "limited",
      retryAfterSeconds: 120,
    });
  });

  it("sayaç anahtarı yalnızca güvenilir başlıktaki IP'dir", async () => {
    const l = limiters();
    await submitFindTable(db, { code: "X", lastName: "Y" }, h("203.0.113.7"), deps(l));
    expect(l.ip.check).toHaveBeenCalledWith("203.0.113.7");
    expect(l.ip.check).not.toHaveBeenCalledWith("198.51.100.9");
  });

  it("güvenilir başlık yoksa X-Forwarded-For okunmaz", async () => {
    const l = limiters();
    await submitFindTable(db, { code: "X", lastName: "Y" }, h("203.0.113.7"), { limiters: l, trustedHeader: undefined });
    const keys = l.ip.check.mock.calls.map((c) => c[0]);
    expect(keys).toHaveLength(1);
    expect(keys).not.toContain("198.51.100.9");
    expect(keys).not.toContain("203.0.113.7");
  });

  it("boş girdi de IP sayacına yazılır", async () => {
    const l = limiters();
    await submitFindTable(db, { code: "", lastName: "" }, h("203.0.113.7"), deps(l));
    expect(l.ip.check).toHaveBeenCalledTimes(1);
  });

  it("aşırı uzun girdi kırpılır, hata vermez", async () => {
    const out = await submitFindTable(db, { code: "A".repeat(5000), lastName: "B".repeat(5000) }, h("203.0.113.7"), deps(limiters()));
    expect(out).toEqual({ kind: "mismatch" });
  });

  it("mesaj sabiti", () => expect(FIND_TABLE_MISMATCH).toBe("Kod ya da soyad hatalı"));
});
