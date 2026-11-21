export const EVENT_STATUSES = ["draft", "published", "active", "completed", "cancelled"] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

const EVENT_TRANSITIONS: Readonly<Record<EventStatus, readonly EventStatus[]>> = {
  draft: ["published", "cancelled"],
  published: ["draft", "active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionEvent(from: EventStatus, to: EventStatus): boolean {
  return EVENT_TRANSITIONS[from].includes(to);
}
