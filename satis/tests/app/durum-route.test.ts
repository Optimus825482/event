import { describe, expect, it, vi } from "vitest";

const availability = vi.fn();
vi.mock("@/features/plan/read", () => ({ getReader: () => ({ availability }) }));

import { GET } from "@/app/api/durum/[eventId]/route";
import { CoreError } from "@/lib/core/errors";

const call = (eventId: string, headers?: HeadersInit) =>
  GET(new Request(`http://satis.test/api/durum/${eventId}`, { headers }), { params: Promise.resolve({ eventId }) });

describe("GET /api/durum/[eventId]", () => {
  it("doluluğu döner", async () => {
    availability.mockResolvedValueOnce({ at: "2026-12-01T10:00:00.000Z", tables: [{ id: "t", free: 1 }] });
    const res = await call("e1");
    expect(res.status).toBe(200);
    expect(availability).toHaveBeenCalledWith("e1");
  });

  it("bilinmeyen etkinlik 404", async () => {
    availability.mockResolvedValueOnce(null);
    expect((await call("e2")).status).toBe(404);
  });

  it("çekirdek hatası 503", async () => {
    availability.mockRejectedValueOnce(new CoreError("core_unreachable", 0));
    expect((await call("e3")).status).toBe(503);
  });
});
