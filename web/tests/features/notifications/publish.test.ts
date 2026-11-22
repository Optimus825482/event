import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { subscribe, type StreamMessage } from "@/features/realtime/hub";
import { closeRealtime, ensureListening } from "@/features/realtime/listener";
import type { NotificationRow } from "@/features/notifications/service";
import { publishNotifications } from "@/features/notifications/publish";
import { waitFor } from "../realtime/helpers";

function row(overrides: Partial<NotificationRow>): NotificationRow {
  return {
    id: randomUUID(),
    type: "system_announcement",
    title: "Duyuru",
    message: "Metin",
    priority: "medium",
    targetRole: "all",
    eventId: null,
    createdAt: new Date(),
    ...overrides,
  } as NotificationRow;
}

const cleanups: Array<() => void> = [];

describe("publishNotifications", () => {
  beforeAll(async () => {
    await ensureListening();
  });
  afterEach(() => {
    while (cleanups.length > 0) cleanups.pop()?.();
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await closeRealtime();
  });

  it("bildirimi hedef role uygun akışlara iletir, diğer rollere iletmez", async () => {
    const staffMessages: StreamMessage[] = [];
    const leaderMessages: StreamMessage[] = [];
    const eventId = randomUUID();
    cleanups.push(subscribe(eventId, (m) => staffMessages.push(m), { role: "staff" }));
    cleanups.push(subscribe(eventId, (m) => leaderMessages.push(m), { role: "leader" }));

    const staffRow = row({ targetRole: "staff" });
    await publishNotifications([staffRow]);
    await waitFor(() => staffMessages.length > 0, 5000, "staff olayı");

    expect(staffMessages[0]).toMatchObject({
      kind: "event",
      event: { type: "notification.created", targetRole: "staff", id: staffRow.id },
    });
    expect(leaderMessages).toEqual([]);
  });

  it("hedefi herkes olan bildirim tüm rollere gider", async () => {
    const messages: StreamMessage[] = [];
    cleanups.push(subscribe(randomUUID(), (m) => messages.push(m), { role: "leader" }));
    await publishNotifications([row({ targetRole: "all" })]);
    await waitFor(() => messages.length > 0, 5000, "herkes olayı");
  });
});
