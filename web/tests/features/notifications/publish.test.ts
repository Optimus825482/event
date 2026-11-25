import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { subscribe, type StreamMessage } from "@/features/realtime/hub";
import { closeRealtime, ensureListening } from "@/features/realtime/listener";
import type { NotificationRow } from "@/features/notifications/service";
import { publishNotifications } from "@/features/notifications/publish";
import { visibleAudiences } from "@/features/notifications/service";
import { managerActor, noAccessActor } from "../../helpers/actors";
import { waitFor } from "../realtime/helpers";

function row(overrides: Partial<NotificationRow>): NotificationRow {
  return {
    id: randomUUID(),
    type: "system_announcement",
    title: "Duyuru",
    message: "Metin",
    priority: "medium",
    audience: "all",
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

  it("bildirimi hedef kitleye uygun akışlara iletir, diğerlerine iletmez", async () => {
    const casinoMessages: StreamMessage[] = [];
    const fnbMessages: StreamMessage[] = [];
    const eventId = randomUUID();
    cleanups.push(subscribe(eventId, (m) => casinoMessages.push(m), { audiences: visibleAudiences(managerActor("casino")) }));
    cleanups.push(subscribe(eventId, (m) => fnbMessages.push(m), { audiences: visibleAudiences(managerActor("fnb")) }));

    const casinoRow = row({ audience: "casino" });
    await publishNotifications([casinoRow]);
    await waitFor(() => casinoMessages.length > 0, 5000, "casino olayı");

    expect(casinoMessages[0]).toMatchObject({
      kind: "event",
      event: { type: "notification.created", audience: "casino", id: casinoRow.id },
    });
    expect(fnbMessages).toEqual([]);
  });

  it("hedefi herkes olan bildirim tüm kitlelere gider", async () => {
    const messages: StreamMessage[] = [];
    cleanups.push(subscribe(randomUUID(), (m) => messages.push(m), { audiences: visibleAudiences(noAccessActor()) }));
    await publishNotifications([row({ audience: "all" })]);
    await waitFor(() => messages.length > 0, 5000, "herkes olayı");
  });
});
