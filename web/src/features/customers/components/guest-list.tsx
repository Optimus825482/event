import { CalendarCheck, Mail, NotebookPen, Phone, Ticket } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import type { CustomerList } from "../queries";
import { GuestNoteDialog } from "./guest-note-dialog";
import { Pagination } from "./customer-list";
import { TagChips } from "./tag-chips";
import { APP_TIME_ZONE } from "@/lib/time-zone";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: APP_TIME_ZONE });

type Props = { list: CustomerList; q: string | undefined; canAddNote: boolean };

/** Misafir kartları (eski misafir sayfası, mor vurgu): iletişim, "Son Katılım", etkinlik sayısı ve "Yeni Not". */
export function GuestList({ list, q, canAddNote }: Props) {
  if (list.items.length === 0) {
    return <EmptyState title={q ? "Aramanızla eşleşen misafir bulunamadı." : "Henüz misafir yok."} />;
  }

  return (
    <div className="space-y-4">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.items.map((c) => (
          <li key={c.id} className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4 hover:border-purple-500/40">
            <div className="flex items-start gap-3">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-purple-600/30 text-lg font-bold text-purple-200"
                aria-hidden
              >
                {c.fullName.trim().charAt(0).toLocaleUpperCase("tr")}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/customers/${c.id}`} className="block truncate font-semibold text-white hover:underline">
                  {c.fullName}
                </Link>
                {c.isBlacklisted ? (
                  <span className="rounded border border-red-500/30 bg-red-600/20 px-2 py-0.5 text-xs text-red-400">Kara liste</span>
                ) : null}
              </div>
            </div>
            <dl className="space-y-1 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <dt className="sr-only">Telefon</dt>
                <Phone className="size-4 shrink-0" aria-hidden />
                <dd>{c.phone ?? "-"}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="sr-only">E-posta</dt>
                <Mail className="size-4 shrink-0" aria-hidden />
                <dd className="truncate">{c.email ?? "-"}</dd>
              </div>
            </dl>
            <TagChips tags={c.tags} />
            <div className="grid grid-cols-2 gap-2 border-t border-slate-700/60 pt-3 text-xs">
              <div>
                <p className="mb-1 text-slate-400">Son Katılım</p>
                <p className="flex items-center gap-1 text-slate-200">
                  <CalendarCheck className="size-3.5 text-purple-400" aria-hidden />
                  {c.lastEventAt ? dateFormat.format(c.lastEventAt) : "-"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-slate-400">Etkinlik</p>
                <p className="flex items-center gap-1 text-slate-200">
                  <Ticket className="size-3.5 text-purple-400" aria-hidden />
                  {c.reservationCount}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <NotebookPen className="size-3.5" aria-hidden />
                {c.noteCount} not
              </span>
              {canAddNote ? <GuestNoteDialog customerId={c.id} guestName={c.fullName} /> : null}
            </div>
          </li>
        ))}
      </ul>
      <Pagination list={list} basePath="/guests" q={q} noun="misafir" />
    </div>
  );
}
