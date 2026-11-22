import { describe, expect, it } from "vitest";
import { describeCameraError } from "@/features/check-in/scanner/camera-errors";

describe("describeCameraError", () => {
  it("izin reddi: izin açma yönergesi ve manuel giriş yolu", () => {
    const message = describeCameraError(new DOMException("Permission denied", "NotAllowedError"));
    expect(message).toContain("izni reddedildi");
    expect(message).toContain("manuel");
  });

  it("html5-qrcode metin hatası da izin reddi sayılır", () => {
    expect(describeCameraError("NotAllowedError : Permission denied")).toContain("izni reddedildi");
  });

  it("kamera yok / meşgul / güvensiz bağlam / bilinmeyen", () => {
    expect(describeCameraError(new DOMException("x", "NotFoundError"))).toContain("bulunamadı");
    expect(describeCameraError(new DOMException("x", "NotReadableError"))).toContain("başka bir uygulama");
    expect(describeCameraError(new Error("mediaDevices insecure context"))).toContain("HTTPS");
    expect(describeCameraError(new Error("???"))).toContain("başlatılamadı");
  });
});
