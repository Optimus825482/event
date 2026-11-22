import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { CreateNotificationForm } from "@/features/notifications/components/create-form";
import { MarkAllReadButton, MarkReadButton } from "@/features/notifications/components/read-buttons";
import { PRIORITY_LABELS, TARGET_ROLE_LABELS } from "@/features/notifications/labels";
import { listNotificationsSchema } from "@/features/notifications/schemas";
import { listNotifications } from "@/features/notifications/service";

export const metadata: Metadata = { title: "Bildirimler | EventFlow" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

function href(page: number, unreadOnly: boolean): string {
  const params = new URLSearchParams();
  if (unreadOnly) params.set("unread", "1");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/notifications?${query}` : "/notifications";
}

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const unreadOnly = first(sp.unread) === "1";
  const parsed = listNotificationsSchema.safeParse({ page: first(sp.page), unreadOnly });
  const actor = await requirePolicyActor();
  const list = await listNotifications(db, actor, parsed.success ? parsed.data : { unreadOnly });
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const canCreate = can(actor, "notifications", "create");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Bildirimler</h1>
          <p className="text-sm text-muted-foreground">
            {list.unreadCount > 0 ? `${list.unreadCount} okunmamış bildirim` : "Okunmamış bildirim yok"}
          </p>
        </div>
        <MarkAllReadButton disabled={list.unreadCount === 0} />
      </div>

      {canCreate ? <CreateNotificationForm /> : null}

      <nav aria-label="Bildirim süzgeci" className="flex gap-2 text-sm">
        <Link
          href={href(1, false)}
          aria-current={unreadOnly ? undefined : "page"}
          className={unreadOnly ? "hover:underline" : "font-semibold underline"}
        >
          Tümü
        </Link>
        <Link
          href={href(1, true)}
          aria-current={unreadOnly ? "page" : undefined}
          className={unreadOnly ? "font-semibold underline" : "hover:underline"}
        >
          Okunmamış
        </Link>
      </nav>

      {list.items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {unreadOnly ? "Okunmamış bildirim yok." : "Henüz bildirim yok."}
        </p>
      ) : (
        <ul className="space-y-3">
          {list.items.map((item) => (
            <li
              key={item.id}
              className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4 ${
                item.isRead ? "border-border" : "border-primary/50 bg-primary/5"
              }`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium">{item.title}</h2>
                  {item.isRead ? null : <Badge>Yeni</Badge>}
                  <Badge variant={item.priority === "urgent" || item.priority === "high" ? "destructive" : "secondary"}>
                    {PRIORITY_LABELS[item.priority]}
                  </Badge>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.message}</p>
                <p className="text-xs text-muted-foreground">
                  {dateFormat.format(item.createdAt)} · {TARGET_ROLE_LABELS[item.targetRole]}
                  {item.eventName ? ` · ${item.eventName}` : ""}
                </p>
                {item.actionUrl ? (
                  <Link href={item.actionUrl} className="text-sm underline">
                    Ayrıntıya git
                  </Link>
                ) : null}
              </div>
              {item.isRead ? null : <MarkReadButton id={item.id} />}
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Sayfalama" className="flex items-center justify-between text-sm">
          {list.page > 1 ? <Link href={href(list.page - 1, unreadOnly)}>Önceki</Link> : <span />}
          <span>
            Sayfa {list.page} / {totalPages}
          </span>
          {list.page < totalPages ? <Link href={href(list.page + 1, unreadOnly)}>Sonraki</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
