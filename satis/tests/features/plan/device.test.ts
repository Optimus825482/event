import { describe, expect, it } from "vitest";
import { canOffer3d } from "@/features/plan/device";

const ok = { webgl: true, deviceMemory: 8, hardwareConcurrency: 8, saveData: false, reducedMotion: false };

describe("canOffer3d", () => {
  it("güçlü cihazda 3B sunulur", () => expect(canOffer3d(ok)).toBe(true));
  it("WebGL bağlamı yoksa sunulmaz", () => expect(canOffer3d({ ...ok, webgl: false })).toBe(false));
  it("deviceMemory 2'den azsa sunulmaz; orta sınıf telefonun 2-4 GB'ı yeterlidir", () => {
    expect(canOffer3d({ ...ok, deviceMemory: 0.5 })).toBe(false);
    expect(canOffer3d({ ...ok, deviceMemory: 1 })).toBe(false);
    expect(canOffer3d({ ...ok, deviceMemory: 2 })).toBe(true);
    expect(canOffer3d({ ...ok, deviceMemory: 4 })).toBe(true);
  });
  it("hardwareConcurrency 2'den azsa sunulmaz; gizlilik tarayıcılarının bildirdiği 2 çekirdek yeterlidir", () => {
    expect(canOffer3d({ ...ok, hardwareConcurrency: 1 })).toBe(false);
    expect(canOffer3d({ ...ok, hardwareConcurrency: 2 })).toBe(true);
    expect(canOffer3d({ ...ok, hardwareConcurrency: 4 })).toBe(true);
  });
  it("veri tasarrufu açıksa sunulmaz", () => expect(canOffer3d({ ...ok, saveData: true })).toBe(false));
  it("hareket azaltma isteniyorsa sunulmaz", () => expect(canOffer3d({ ...ok, reducedMotion: true })).toBe(false));
  it("bilinmeyen değerler (Safari'de deviceMemory yok) engel sayılmaz", () => {
    expect(canOffer3d({ webgl: true, reducedMotion: false })).toBe(true);
    expect(canOffer3d({ ...ok, deviceMemory: undefined, hardwareConcurrency: undefined, saveData: undefined })).toBe(true);
  });
});
