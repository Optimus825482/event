import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db/client";
import { can } from "@/features/auth/policy";
import { requirePolicyActor } from "@/features/auth/permissions";
import { CustomerSummary } from "@/features/customers/components/customer-summary";
import { CustomerControls } from "@/features/customers/components/customer-controls";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { NotesPanel } from "@/features/customers/components/notes-panel";
import { TagsEditor } from "@/features/customers/components/tags-editor";
import { getCustomerDetail } from "@/features/customers/queries";
import { APP_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = { title: "Müşteri | EventFlow" };

const STATUS_LABELS: Record<string, string> = {
  pending: "Beklemede",
  confirmed: "Onaylı",
  checked_in: "Giriş yaptı",
  cancelled: "İptal",
  no_show: "Gelmedi",
};

// Sunucu bileşeni kapsayıcının saat dilimini (UTC) kullanırdı; gece yarısına yakın etkinlikler önceki günü gösterirdi.
const CARD = "space-y-3 rounded-2xl border border-slate-700 bg-slate-800/50 p-5";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: APP_TIME_ZONE });

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePolicyActor();
  if (!can(actor, "customers", "view")) {
    return <p className="text-sm text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</p>;
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getCustomerDetail(db, actor, id);
  if (!detail) notFound();

  const { customer } = detail;
  const canEdit = can(actor, "customers", "edit");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-3">
        <Link href="/customers" className="text-sm text-slate-400 hover:text-white">
          ← Müşteriler
        </Link>
        <CustomerSummary
          fullName={customer.fullName}
          vipScore={customer.vipScore}
          isBlacklisted={customer.isBlacklisted}
          totalReservations={customer.totalReservations}
          totalAttendedEvents={customer.totalAttendedEvents}
          noShowCount={customer.noShowCount}
          lastEventAt={customer.lastEventAt}
          tags={detail.tags}
        />
      </div>

      <section aria-labelledby="info" className={CARD}>
        <h2 id="info" className="text-lg font-medium">
          Bilgiler
        </h2>
        {canEdit ? (
          <CustomerForm
            customer={{
              id: customer.id,
              fullName: customer.fullName,
              phone: customer.phone,
              email: customer.email,
              vipScore: customer.vipScore,
              notes: customer.notes,
            }}
          />
        ) : (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Telefon</dt><dd>{customer.phone ?? "-"}</dd></div>
            <div><dt className="text-muted-foreground">E-posta</dt><dd>{customer.email ?? "-"}</dd></div>
            <div><dt className="text-muted-foreground">VIP puanı</dt><dd>{customer.vipScore}</dd></div>
            <div><dt className="text-muted-foreground">Notlar</dt><dd>{customer.notes ?? "-"}</dd></div>
          </dl>
        )}
        <CustomerControls
          customerId={customer.id}
          isBlacklisted={customer.isBlacklisted}
          canEdit={canEdit}
          canDelete={can(actor, "customers", "delete")}
        />
      </section>

      <section aria-labelledby="tags" className={CARD}>
        <h2 id="tags" className="text-lg font-medium">
          Etiketler
        </h2>
        <TagsEditor customerId={customer.id} tags={detail.tags} canEdit={canEdit} />
      </section>

      <section id="notes" aria-labelledby="notes-title" className={CARD}>
        <h2 id="notes-title" className="text-lg font-medium">
          Misafir notları
        </h2>
        <NotesPanel
          customerId={customer.id}
          canEdit={canEdit}
          notes={detail.notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))}
        />
      </section>

      <section aria-labelledby="history" className={CARD}>
        <h2 id="history" className="text-lg font-medium">
          Rezervasyon geçmişi
        </h2>
        {detail.reservations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rezervasyon yok.</p>
        ) : (
          <ul className="divide-y divide-slate-700 rounded-xl border border-slate-700 text-sm">
            {detail.reservations.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="font-medium">{r.eventName}</span>
                <span className="text-muted-foreground">
                  {dateFormat.format(r.eventStartsAt)} · {r.guestCount} kişi
                </span>
                <Badge variant="outline">{STATUS_LABELS[r.status] ?? r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
