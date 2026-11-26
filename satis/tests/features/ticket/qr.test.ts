import { describe, expect, it } from "vitest";
import { qrDataUrl } from "@/features/ticket/qr";

describe("qrDataUrl", () => {
  it("QR PNG veri adresi üretir; farklı içerik farklı görsel verir", async () => {
    const a = await qrDataUrl("belirtec-1");
    const b = await qrDataUrl("belirtec-2");
    expect(a.startsWith("data:image/png;base64,")).toBe(true);
    expect(a).not.toBe(b);
    expect(await qrDataUrl("belirtec-1")).toBe(a);
  });
});
