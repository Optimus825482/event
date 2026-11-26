import { describe, expect, it } from "vitest";
import { clientIp } from "@/lib/client-ip";

const h = (init: Record<string, string>) => new Headers(init);

describe("istemci IP'si", () => {
  it("güvenilir başlık tanımsızsa IP yoktur", () =>
    expect(clientIp(h({ "x-forwarded-for": "198.51.100.9", "x-real-ip": "203.0.113.7" }), undefined)).toBeNull());
  it("yalnızca güvenilir başlık okunur", () =>
    expect(clientIp(h({ "x-forwarded-for": "198.51.100.9", "x-real-ip": "203.0.113.7" }), "x-real-ip")).toBe(
      "203.0.113.7",
    ));
  it("istemcinin gönderdiği x-forwarded-for anahtarı değiştiremez", () =>
    expect(clientIp(h({ "x-forwarded-for": "198.51.100.9" }), "x-real-ip")).toBeNull());
  it("virgüllü değerde ilk adres alınır", () =>
    expect(clientIp(h({ "x-real-ip": "203.0.113.7, 10.0.0.1" }), "x-real-ip")).toBe("203.0.113.7"));
  it("IP olmayan değer reddedilir", () => expect(clientIp(h({ "x-real-ip": "<script>" }), "x-real-ip")).toBeNull());
  it("IPv6 kabul edilir", () => expect(clientIp(h({ "x-real-ip": "2001:db8::1" }), "x-real-ip")).toBe("2001:db8::1"));
  it("geçersiz başlık adı hata fırlatmaz", () => expect(clientIp(h({}), "geçersiz ad")).toBeNull());
});
