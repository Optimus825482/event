// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAvailability } from "@/features/plan/use-availability";
import type { Availability } from "@/lib/core/contract";

const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const initial: Availability = { at: "2026-12-01T10:00:00.000Z", tables: [{ id: "t", free: 8, freeSeats: seq(8) }] };
const body = (at: string, free: number): Availability => ({ at, tables: [{ id: "t", free, freeSeats: seq(free) }] });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

let fetchMock: ReturnType<typeof vi.fn>;
const setVisibility = (state: "visible" | "hidden") =>
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-12-01T10:00:10.000Z"));
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  setVisibility("visible");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe("useAvailability", () => {
  it("5 sn sonra /api/durum/<id> sorgulanır ve durum güncellenir", async () => {
    fetchMock.mockImplementation(async () => json(body("2026-12-01T10:00:05.000Z", 4)));
    const { result } = renderHook(() => useAvailability("ev1", initial));
    await advance(4999);
    expect(fetchMock).not.toHaveBeenCalled();
    await advance(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/durum/ev1");
    expect(result.current.availability.tables[0]?.free).toBe(4);
  });

  it("sekme gizliyken sorgulamaz, görünür olunca hemen sorgular", async () => {
    fetchMock.mockImplementation(async () => json(body("2026-12-01T10:00:05.000Z", 4)));
    setVisibility("hidden");
    renderHook(() => useAvailability("ev1", initial));
    await advance(20_000);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    setVisibility("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ardışık hatalarda geri çekilir, üçte stale olur, başarıyla normale döner", async () => {
    fetchMock.mockImplementation(async () => json({ error: "unavailable" }, 503));
    const { result } = renderHook(() => useAvailability("ev1", initial));
    await advance(5000); // hata 1; sonraki 10 sn
    await advance(9000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1000); // hata 2; sonraki 20 sn
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.stale).toBe(false);
    await advance(20_000); // hata 3
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current.stale).toBe(true);
    fetchMock.mockImplementation(async () => json(body("2026-12-01T10:00:30.000Z", 3)));
    await advance(30_000); // tavan 30 sn
    expect(result.current.stale).toBe(false);
    await advance(5000); // normal aralık
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("bozuk satırlı yanıt hata sayılır ve duruma girmez", async () => {
    fetchMock.mockImplementation(async () => json({ at: "2026-12-01T10:00:20.000Z", tables: [{ id: "t", free: "çok" }] }));
    const { result } = renderHook(() => useAvailability("ev1", initial));
    await advance(5000);
    expect(result.current.availability).toBe(initial);
    fetchMock.mockImplementation(async () => json({ at: "2026-12-01T10:00:20.000Z", tables: [null] }));
    await advance(10_000);
    expect(result.current.availability).toBe(initial);
  });

  it("patch yerel değeri değiştirir; eski yanıt onu geri almaz, daha yeni sunucu yanıtı yamayı düşürür", async () => {
    fetchMock.mockImplementation(async () => json(body("2026-12-01T09:59:59.000Z", 6)));
    const { result } = renderHook(() => useAvailability("ev1", initial));
    act(() => result.current.patch("t", 0));
    expect(result.current.availability.tables[0]?.free).toBe(0);
    await advance(5000);
    expect(fetchMock).toHaveBeenCalled();
    expect(result.current.availability.tables[0]?.free).toBe(0);
    fetchMock.mockImplementation(async () => json(body("2026-12-01T10:00:20.000Z", 2)));
    await advance(5000);
    expect(result.current.availability.tables[0]?.free).toBe(2);
  });

  it("yama ~8 sn sonra düşer", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 304 }));
    const { result } = renderHook(() => useAvailability("ev1", initial));
    act(() => result.current.patch("t", 0));
    await advance(7000);
    expect(result.current.availability.tables[0]?.free).toBe(0);
    await advance(1500);
    expect(result.current.availability.tables[0]?.free).toBe(8);
  });

  it("cihaz saati sunucudan 10 dk ileri olsa da sunucu yanıtları uygulanır", async () => {
    vi.setSystemTime(new Date("2026-12-01T10:10:00.000Z"));
    fetchMock.mockImplementation(async () => json(body("2026-12-01T10:00:20.000Z", 2)));
    const { result } = renderHook(() => useAvailability("ev1", initial));
    act(() => result.current.patch("t", 0));
    expect(result.current.availability.tables[0]?.free).toBe(0);
    await advance(5000);
    expect(result.current.availability.tables[0]?.free).toBe(2);
    fetchMock.mockImplementation(async () => json(body("2026-12-01T10:00:30.000Z", 1)));
    await advance(5000);
    expect(result.current.availability.tables[0]?.free).toBe(1);
  });

  it("304 yanıtında durum aynı kalır", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 304 }));
    const { result } = renderHook(() => useAvailability("ev1", initial));
    await advance(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.availability).toBe(initial);
    expect(result.current.stale).toBe(false);
  });

  it("freeSeats taşımayan yanıt geçersiz sayılır ve durum korunur", async () => {
    fetchMock.mockImplementation(async () => json({ at: "2026-12-01T10:00:20.000Z", tables: [{ id: "t", free: 4 }] }));
    const { result } = renderHook(() => useAvailability("ev1", initial));
    await advance(5000);
    expect(result.current.availability).toBe(initial);

    fetchMock.mockImplementation(async () =>
      json({ at: "2026-12-01T10:00:25.000Z", tables: [{ id: "t", free: 4, freeSeats: [0, 1] }] }),
    );
    await advance(10_000);
    expect(result.current.availability).toBe(initial);
  });
});
