import { Music } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db/client";
import { ArchiveTable } from "@/features/archive/components/archive-table";
import { NetAmount } from "@/features/archive/components/net-amount";
import { formatMoney, formatRate } from "@/features/archive/format";
import { ArtistDeleteButton } from "@/features/artists/components/artist-delete-button";
import { ArtistForm } from "@/features/artists/components/artist-form";
import { getArtistHistory } from "@/features/artists/comparison";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { DomainError } from "@/lib/action";

export const metadata: Metadata = { title: "Sanatçı | EventFlow" };

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePolicyActor();
  const { id } = await params;
  const { artist, events, totals } = await getArtistHistory(db, actor, id).catch((error: unknown) => {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={artist.name}
        description={artist.genre ?? undefined}
        icon={<Music className="size-8 text-blue-400" aria-hidden />}
        actions={
          <>
            <Link className={buttonVariants({ variant: "outline" })} href="/artists">
              Sanatçılara dön
            </Link>
            {can(actor, "archive", "delete") ? <ArtistDeleteButton id={artist.id} name={artist.name} /> : null}
          </>
        }
      />
      {can(actor, "archive", "edit") ? (
        <section aria-labelledby="edit-artist" className="space-y-3 rounded-xl border border-slate-500 bg-card p-5 text-card-foreground">
          <h2 id="edit-artist" className="text-lg font-medium text-foreground">
            Sanatçı bilgileri
          </h2>
          <ArtistForm
            artist={{ id: artist.id, name: artist.name, genre: artist.genre, notes: artist.notes, isActive: artist.isActive }}
          />
        </section>
      ) : null}
      <section aria-labelledby="history" className="space-y-3">
        <h2 id="history" className="text-lg font-medium text-foreground">
          Geçmiş etkinlikler
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu sanatçının arşivlenmiş etkinliği yok.</p>
        ) : (
          <>
            <ArchiveTable items={events} caption="Sanatçının geçmiş etkinlikleri" showArtist={false} />
            <Table>
              <caption className="sr-only">Para birimi başına toplamlar</caption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Para birimi</TableHead>
                  <TableHead scope="col" className="text-right">Etkinlik</TableHead>
                  <TableHead scope="col" className="text-right">Satılan bilet</TableHead>
                  <TableHead scope="col" className="text-right">Bilet geliri</TableHead>
                  <TableHead scope="col" className="text-right">Net (gerçekleşen)</TableHead>
                  <TableHead scope="col" className="text-right">Katılım</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {totals.map((t) => (
                  <TableRow key={t.currency}>
                    <TableCell className="font-medium text-foreground">Toplam ({t.currency})</TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">{t.eventCount}</TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">{t.ticketsSold}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-foreground">
                      {formatMoney(t.ticketRevenue, t.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <NetAmount amount={t.netActual} currency={t.currency} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">{formatRate(t.rates.attendance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </section>
    </div>
  );
}
