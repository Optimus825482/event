import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { CreateNotificationForm } from "@/features/notifications/components/create-form";
import { MarkAllReadButton, MarkReadButton } from "@/features/notifications/components/read-buttons";
import { PRIORITY_STYLES, READ_CARD } from "@/features/notifications/components/priority-style";
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

  const filterClass = (active: boolean) =>
    active
      ? "rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white"
      : "rounded-lg px-3 py-1.5 text-slate-400 hover:bg-slate-700 hover:text-white";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        className="mb-0"
        title="Bildirimler"
        description={list.unreadCount > 0 ? `${list.unreadCount} okunmamış bildirim` : "Okunmamış bildirim yok"}
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </div>
        }
        actions={<MarkAllReadButton disabled={list.unreadCount === 0} />}
      />

      {canCreate ? <CreateNotificationForm /> : null}

      <nav aria-label="Bildirim süzgeci" className="inline-flex gap-1 rounded-xl border border-slate-700 bg-slate-800 p-1 text-sm">
        <Link href={href(1, false)} aria-current={unreadOnly ? undefined : "page"} className={filterClass(!unreadOnly)}>
          Tümü
        </Link>
        <Link href={href(1, true)} aria-current={unreadOnly ? "page" : undefined} className={filterClass(unreadOnly)}>
          Okunmamış
        </Link>
      </nav>

      {list.items.length === 0 ? (
        <EmptyState
          icon={<BellOff aria-hidden="true" />}
          title={unreadOnly ? "Okunmamış bildirim yok." : "Henüz bildirim yok."}
        />
      ) : (
        <ul className="space-y-3">
          {list.items.map((item) => {
            const style = PRIORITY_STYLES[item.priority];
            const Icon = style.icon;
            return (
              <li
                key={item.id}
                className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4 ${
                  item.isRead ? READ_CARD : style.unreadCard
                }`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${style.tile}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className={item.isRead ? "font-medium text-slate-300" : "font-semibold text-white"}>{item.title}</h2>
                      {item.isRead ? null : (
                        <span className="rounded-full border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300">
                          Yeni
                        </span>
                      )}
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                        {PRIORITY_LABELS[item.priority]}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-400">{item.message}</p>
                    <p className="text-xs text-slate-500">
                      {dateFormat.format(item.createdAt)} · {TARGET_ROLE_LABELS[item.targetRole]}
                      {item.eventName ? ` · ${item.eventName}` : ""}
                    </p>
                    {item.actionUrl ? (
                      <Link href={item.actionUrl} className="text-sm text-blue-400 hover:underline">
                        Ayrıntıya git
                      </Link>
                    ) : null}
                  </div>
                </div>
                {item.isRead ? null : <MarkReadButton id={item.id} />}
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Sayfalama" className="flex items-center justify-between text-sm text-slate-300">
          {list.page > 1 ? <Link href={href(list.page - 1, unreadOnly)} className="hover:text-white">Önceki</Link> : <span />}
          <span>
            Sayfa {list.page} / {totalPages}
          </span>
          {list.page < totalPages ? <Link href={href(list.page + 1, unreadOnly)} className="hover:text-white">Sonraki</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
