import {
  getAccessFallbackHTTPStatus,
  isHTTPAccessFallbackError,
} from "next/dist/client/components/http-access-fallback/http-access-fallback";
import { forbidden } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ForbiddenError } from "@/features/auth/errors";
import { createAction } from "@/lib/action";

describe("ForbiddenError ve Next 403 sayfası", () => {
  it("Next'in forbidden() hatasıyla aynı özeti taşır; böylece forbidden.tsx 403 olarak gösterilir", () => {
    const error = new ForbiddenError();
    expect(isHTTPAccessFallbackError(error)).toBe(true);
    expect(getAccessFallbackHTTPStatus(error)).toBe(403);

    process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS = "true";
    try {
      forbidden();
    } catch (thrown) {
      expect((thrown as { digest: string }).digest).toBe(error.digest);
    } finally {
      delete process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS;
    }
  });

  it("sunucu eylemleri ForbiddenError'ı yine forbidden sonucuna çevirir, günlüğe yazmaz", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const actor = { id: "00000000-0000-4000-8000-000000000001", username: "x", role: "admin", staffId: null } as const;
      const run = createAction({ getActor: async () => actor }).defineAction({
        module: "events",
        verb: "view",
        input: z.object({}),
        handler: async () => {
          throw new ForbiddenError();
        },
      });
      expect(await run({})).toEqual({ ok: false, code: "forbidden", message: "Bu işlem için yetkiniz yok" });
      expect(stderr).not.toHaveBeenCalled();
    } finally {
      stderr.mockRestore();
    }
  });
});
