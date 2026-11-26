import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Dosyalar metin olarak okunur (YAML ayrıştırıcı bağımlılığı yok).
const read = (relativePath: string) => readFileSync(resolve(import.meta.dirname, relativePath), "utf8").replace(/\r\n/g, "\n");

const coolify = read("../../../docker-compose.coolify.yaml");
const local = read("../../../docker-compose.yml");
const dockerfile = read("../../Dockerfile");

describe("dağıtım dosyaları", () => {
  it("coolify: satis servisi kendi imajını ./satis'ten derler", () => {
    expect(coolify).toMatch(/\n {2}satis:\n/);
    expect(coolify).toContain("context: ./satis");
    expect(coolify).toContain("image: eventflow-satis:coolify");
  });

  it("coolify: satis çekirdeğe iç ağ takma adıyla gider; sır boş varsayılanlıdır", () => {
    expect(coolify).toContain("CORE_API_URL: http://eventflow-core:3000");
    expect(coolify).toContain("SALES_API_SECRET: ${SALES_API_SECRET:-}");
    expect(coolify).toContain("SITE_URL: ${SALES_SITE_URL:-}");
    expect(coolify).toMatch(/aliases:\s*\n\s*- eventflow-core/);
  });

  it("coolify: özel Traefik etiketi yoktur (Coolify yönlendiricisiyle çakışıp canlıda döngü yaptı)", () => {
    expect(coolify).not.toMatch(/^\s*- traefik\./m);
    expect(coolify).not.toContain("replacepath");
  });

  it("satis servisi 'satis' profili arkasındadır (varsayılan kapalı)", () => {
    for (const text of [coolify, local]) {
      const block = text.slice(text.indexOf("\n  satis:\n"));
      expect(block).toMatch(/^ {4}profiles: \["satis"\]$/m);
    }
  });

  it("satış değişkenleri için hiçbir ':?' zorunluluğu kalmaz (ana yığın onlarsız dağıtılır)", () => {
    for (const text of [coolify, local]) {
      expect(text).not.toMatch(/\$\{(SALES_API_SECRET|SALES_SITE_URL|WEB_PUBLIC_HOST):\?/);
    }
  });

  it("hiçbir compose dosyasında NEXT_PUBLIC_ değişkeni yoktur", () => {
    expect(coolify).not.toContain("NEXT_PUBLIC_");
    expect(local).not.toContain("NEXT_PUBLIC_");
  });

  it("yerel compose: satis yalnızca 127.0.0.1'e bağlanır", () => {
    expect(local).toContain('"127.0.0.1:3001:3000"');
  });

  it("Dockerfile: kök olmayan kullanıcı, sağlık denetimi, standalone", () => {
    expect(dockerfile).toContain("USER nextjs");
    expect(dockerfile).toMatch(/HEALTHCHECK[\s\S]*\/api\/health/);
    expect(dockerfile).toContain(".next/standalone");
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
  });

  it("Dockerfile çalışma aşaması sır ya da çekirdek adresi gömmez", () => {
    const runner = dockerfile.slice(dockerfile.lastIndexOf("FROM "));
    expect(runner).not.toContain("SALES_API_SECRET");
    expect(runner).not.toContain("CORE_API_URL");
  });
});
