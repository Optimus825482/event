// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAvailability } from "@/features/plan/use-availability";
import type { Availability } from "@/lib/core/contract";

const initial: Availability = { at: "2026-12-01T10:00:00.000Z", tables: [{ id: "t", free: 8 }] };
const body = (at: string, free: number): Availability => ({ at, tables: [{ id: "t", free }] });
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

  it("ardışık üç hatada stale olur, başarıyla düzelir", async () => {
    fetchMock.mockImplementation(async () => json({ error: "unavailable" }, 503));
    const { result } = renderHook(() => useAvailability("ev1", initial));
    await advance(5000);
    await advance(5000);
    expect(result.current.stale).toBe(false);
    await advance(5000);
    expect(result.current.stale).toBe(true);
    fetchMock.mockImplementation(async () => json(body("2026-12-01T10:00:30.000Z", 3)));
    await advance(5000);
    expect(result.current.stale).toBe(false);
  });

  it("patch yerel değeri değiştirir ve daha eski yanıt onu geri almaz", async () => {
    fetchMock.mockImplementation(async () => json(body("2026-12-01T10:00:02.000Z", 6)));
    const { result } = renderHook(() => useAvailability("ev1", initial));
    act(() => result.current.patch("t", 0));
    expect(result.current.availability.tables[0]?.free).toBe(0);
    await advance(5000);
    expect(fetchMock).toHaveBeenCalled();
    expect(result.current.availability.tables[0]?.free).toBe(0);
  });

  it("304 yanıtında durum aynı kalır", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 304 }));
    const { result } = renderHook(() => useAvailability("ev1", initial));
    await advance(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.availability).toBe(initial);
    expect(result.current.stale).toBe(false);
  });
});
