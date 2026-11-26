import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Dosyalar metin olarak okunur (YAML ayrıştırıcı bağımlılığı yok).
const read = (relativePath: string) => readFileSync(resolve(import.meta.dirname, relativePath), "utf8");

const coolify = read("../../../docker-compose.coolify.yaml");
const local = read("../../../docker-compose.yml");
const dockerfile = read("../../Dockerfile");

describe("dağıtım dosyaları", () => {
  it("coolify: satis servisi kendi imajını ./satis'ten derler", () => {
    expect(coolify).toMatch(/\n {2}satis:\n/);
    expect(coolify).toContain("context: ./satis");
    expect(coolify).toContain("image: eventflow-satis:coolify");
  });

  it("coolify: satis çekirdeğe iç ağ takma adıyla gider ve sır zorunludur", () => {
    expect(coolify).toContain("CORE_API_URL: http://eventflow-core:3000");
    expect(coolify).toMatch(/SALES_API_SECRET: \$\{SALES_API_SECRET:\?/);
    expect(coolify).toMatch(/SITE_URL: \$\{SALES_SITE_URL:\?/);
    expect(coolify).toMatch(/aliases:\s*\n\s*- eventflow-core/);
  });

  it("coolify: /api/sales dışarıya kapalıdır", () => {
    expect(coolify).toContain("eventflow-sales-block");
    expect(coolify).toContain("PathPrefix(`/api/sales`)");
    expect(coolify).toMatch(/WEB_PUBLIC_HOST:\?/);
  });

  it("coolify: engel hem http hem https router'ında vardır ve https olan tls=true taşır", () => {
    const label = (router: string, key: string) =>
      coolify.match(new RegExp(`traefik\.http\.routers\.${router}\.${key}=(.+)`))?.[1]?.trim();
    expect(label("eventflow-sales-block", "entrypoints")).toBe("http");
    expect(label("eventflow-sales-block-tls", "entrypoints")).toBe("https");
    expect(label("eventflow-sales-block-tls", "tls")).toBe("true");
    expect(label("eventflow-sales-block-tls", "rule")).toBeDefined();
    expect(label("eventflow-sales-block-tls", "rule")).toBe(label("eventflow-sales-block", "rule"));
    expect(label("eventflow-sales-block-tls", "priority")).toBe(label("eventflow-sales-block", "priority"));
    expect(label("eventflow-sales-block-tls", "middlewares")).toBe(label("eventflow-sales-block", "middlewares"));
    expect(label("eventflow-sales-block-tls", "service")).toBe(label("eventflow-sales-block", "service"));
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
