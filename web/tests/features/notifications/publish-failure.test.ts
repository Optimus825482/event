import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/realtime/publish", () => ({
  publish: vi.fn(async () => {
    throw new Error("bağlantı koptu");
  }),
}));

import { publishNotifications } from "@/features/notifications/publish";
import type { NotificationRow } from "@/features/notifications/service";

describe("publishNotifications hata yutma", () => {
  it("yayın başarısız olsa da fırlatmaz ve hatayı günlüğe yazar", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const created = { id: crypto.randomUUID(), targetRole: "all" } as NotificationRow;

    await expect(publishNotifications([created])).resolves.toBeUndefined();

    expect(stderr).toHaveBeenCalled();
    stderr.mockRestore();
  });
});
