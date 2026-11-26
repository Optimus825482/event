import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memberActor } from "../../helpers/actors";

// Oturum ve etkinlik araması taklit edilir: `ticketing` enum değeri veritabanına Task 1'de girer,
// bu yüzden bu görevde izin satırı yazan test eklenmez.
const getActorFromHeaders = vi.fn();
vi.mock("@/features/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth/session")>()),
  getActorFromHeaders: (h: Headers) => getActorFromHeaders(h),
}));
vi.mock("@/features/events/service", () => ({ getEventOrThrow: vi.fn(async () => ({})) }));

import { authorizeStream } from "@/features/realtime/access";

describe("authorizeStream", () => {
  beforeEach(() => getActorFromHeaders.mockReset());

  it("ticketing:view izni olan kullanıcı akışa bağlanır", async () => {
    getActorFromHeaders.mockResolvedValue(memberActor("entertainment", { ticketing: "v---" }));
    expect((await authorizeStream(new Headers(), randomUUID())).ok).toBe(true);
  });

  it("ticketing:view yoksa ve başka izin de yoksa 403 olur", async () => {
    getActorFromHeaders.mockResolvedValue(memberActor("entertainment", { ticketing: "----" }));
    expect(await authorizeStream(new Headers(), randomUUID())).toMatchObject({ ok: false, status: 403 });
  });
});
