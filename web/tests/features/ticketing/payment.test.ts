import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { demoProvider } from "@/features/ticketing/payment/demo";
import { resolveProvider } from "@/features/ticketing/payment/registry";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("ödeme sağlayıcı kaydı", () => {
  it("kayıt: disabled → sağlayıcı yok, demo → demo sağlayıcı", () => {
    expect(resolveProvider("disabled")).toBeNull();
    expect(resolveProvider("demo")).toBe(demoProvider);
  });

  it("demo sağlayıcı kendini demo olarak işaretler ve yalnızca istenen sonucu döner", async () => {
    expect(demoProvider).toMatchObject({ id: "demo", isDemo: true });
    const input = { orderId: randomUUID(), amount: "3000.00", currency: "TRY" };
    const ok = await demoProvider.start({ ...input, request: { provider: "demo", action: "approve" } });
    expect(ok.outcome).toBe("approved");
    expect(ok.providerRef).toMatch(/^demo-/);
    expect((await demoProvider.start({ ...input, request: { provider: "demo", action: "decline" } })).outcome).toBe(
      "declined",
    );
    expect(demoProvider.verifyCallback).toBeUndefined();
    expect(demoProvider.refund).toBeUndefined();
  });

  it("demo sağlayıcıyı yalnızca kayıt dosyası içe aktarır (başka yoldan etkinleşemez)", () => {
    const srcRoot = path.resolve(import.meta.dirname, "../../../src");
    const importers = walk(srcRoot)
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => /payment\/demo["']|from\s+["']\.\/demo["']/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(srcRoot, file).split(path.sep).join("/"));
    expect(importers).toEqual(["features/ticketing/payment/registry.ts"]);
  });

  it("compose dosyaları ödeme sağlayıcıyı varsayılan olarak kapalı geçirir", () => {
    const root = path.resolve(import.meta.dirname, "../../../..");
    for (const file of ["docker-compose.yml", "docker-compose.coolify.yaml"]) {
      const text = readFileSync(path.join(root, file), "utf8");
      expect(text).toContain("PAYMENT_PROVIDER: ${PAYMENT_PROVIDER:-disabled}");
      expect(text).not.toMatch(/PAYMENT_PROVIDER:\s*demo/);
      expect(text).toContain("SALES_API_SECRET: ${SALES_API_SECRET:-}");
    }
  });

  it(".env.example üç adı değersiz taşır", () => {
    const text = readFileSync(path.resolve(import.meta.dirname, "../../../.env.example"), "utf8");
    for (const name of ["SALES_API_SECRET", "PAYMENT_PROVIDER", "SALES_SITE_URL"]) {
      expect(text).toMatch(new RegExp(`^${name}=$`, "m"));
    }
  });
});
