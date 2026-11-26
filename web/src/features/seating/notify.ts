import type { NewNotification } from "@/features/notifications/service";

const byLabel = (a: { label: string }, b: { label: string }) =>
  a.label.localeCompare(b.label, "tr", { numeric: true });

/** Casino'nun serbest bıraktığı masalar için Entertainment'a giden bildirim. Saf. */
export function buildReleaseNotification(args: {
  event: { id: string; name: string };
  actorId: string;
  actorName: string;
  tables: { id: string; label: string }[];
}): NewNotification {
  const { event, actorId, actorName } = args;
  const tables = [...args.tables].sort(byLabel);
  return {
    type: "casino_tables_released",
    audience: "entertainment",
    priority: "medium",
    eventId: event.id,
    createdById: actorId,
    actionUrl: `/events/${event.id}/tables`,
    title: `Casino masaları serbest bıraktı: ${event.name}`,
    message: `${actorName}, "${event.name}" etkinliğinde ${tables.length} masayı serbest bıraktı. Bu masaları satışa açabilirsiniz.`,
    metadata: { tableIds: tables.map((t) => t.id), labels: tables.map((t) => t.label) },
  };
}
