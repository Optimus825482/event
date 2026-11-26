import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("sağlık ucu çekirdeğe gitmeden 200 döner", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(spy).not.toHaveBeenCalled();
  });
});
