import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DEMO_NOTICE, formatMoney, formatRate } from "../format";
import type { ArchiveSummary } from "../read";
import { DemoBadge } from "./demo-badge";
import { NetAmount } from "./net-amount";

function Section({ id, title, className, children }: { id: string; title: string; className?: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className={cn("space-y-3 rounded-xl border border-slate-500 bg-card p-5 text-card-foreground", className)}
    >
      <h2 id={id} className="text-lg font-medium text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stats({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="space-y-0.5">
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="font-medium tabular-nums text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Arşiv ayrıntısı bölümleri (yalnızca anlık görüntü; sunucu bileşeni). */
export function ArchiveDetail({ archive: a }: { archive: ArchiveSummary }) {
  const { categories, financeItems, gates } = a.details;
  const cur = a.currency;
  return (
    <div className="space-y-6">
      <Section id="attendance" title="Katılım ve oranlar">
        <Stats
          items={[
            { label: "Doluluk", value: formatRate(a.rates.occupancy) },
            { label: "Katılım", value: formatRate(a.rates.attendance) },
            { label: "No-show", value: formatRate(a.rates.noShow) },
            { label: "Girişi yapılan bilet", value: a.ticketsCheckedIn },
            { label: "Beklenen misafir", value: a.guestsExpected },
            { label: "Giriş yapan misafir", value: a.guestsCheckedIn },
            { label: "F&B personeli", value: a.fnbStaffCount },
          ]}
        />
      </Section>

      <Section id="tables" title="Masalar">
        <Stats
          items={[
            { label: "Masa sayısı", value: a.tableCount },
            { label: "Toplam kapasite", value: a.totalCapacity },
            { label: "Casino masası", value: a.casinoTableCount },
            { label: "Casino sandalyesi", value: a.casinoSeatCount },
            { label: "Online masa", value: a.onlineTableCount },
            { label: "Satılabilir sandalye", value: a.sellableSeatCount },
          ]}
        />
      </Section>

      <Section id="tickets" title="Bilet satışı (gerçek)">
        <Stats
          items={[
            { label: "Satılan bilet", value: a.ticketsSold },
            { label: "Bilet geliri", value: formatMoney(a.ticketRevenue, cur) },
          ]}
        />
      </Section>

      {a.hasDemo ? (
        <Section id="demo" title="Demo satış" className="border-amber-700 dark:border-amber-400">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
            <DemoBadge count={a.demoTicketsSold} />
            <span>{DEMO_NOTICE}</span>
          </p>
          <Stats
            items={[
              { label: "Demo bilet", value: a.demoTicketsSold },
              { label: "Demo gelir", value: formatMoney(a.demoTicketRevenue, cur) },
            ]}
          />
        </Section>
      ) : null}

      <Section id="reservations" title="Rezervasyonlar">
        <Stats
          items={[
            { label: "Rezervasyon", value: a.reservationCount },
            { label: "Giriş yapan", value: a.reservationsCheckedIn },
            { label: "Gelmeyen (no-show)", value: a.reservationsNoShow },
          ]}
        />
      </Section>

      <Section id="finance" title="Finans">
        {a.artistFee !== null ? <Stats items={[{ label: "Sanatçı ücreti", value: formatMoney(a.artistFee, cur) }]} /> : null}
        {financeItems.length > 0 ? (
          <Table>
            <caption className="sr-only">Finans kalemleri</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Yön</TableHead>
                <TableHead scope="col">Kategori</TableHead>
                <TableHead scope="col">Kalem</TableHead>
                <TableHead scope="col" className="text-right">Tahmini</TableHead>
                <TableHead scope="col" className="text-right">Gerçekleşen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financeItems.map((item, i) => (
                <TableRow key={`${item.direction}-${item.category}-${item.label}-${i}`}>
                  <TableCell className="text-foreground">{item.direction === "expense" ? "Gider" : "Gelir"}</TableCell>
                  <TableCell className="text-foreground">{item.category}</TableCell>
                  <TableCell className="text-foreground">{item.label}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-foreground">
                    {formatMoney(item.estimatedAmount, cur)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-foreground">
                    {item.actualAmount === null ? "—" : formatMoney(item.actualAmount, cur)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Finans kalemi yok.</p>
        )}
        <Stats
          items={[
            { label: "Tahmini gider", value: formatMoney(a.estimatedExpense, cur) },
            { label: "Gerçekleşen gider", value: formatMoney(a.actualExpense, cur) },
            { label: "Tahmini diğer gelir", value: formatMoney(a.estimatedOtherIncome, cur) },
            { label: "Gerçekleşen diğer gelir", value: formatMoney(a.actualOtherIncome, cur) },
            { label: "Net (gerçekleşen)", value: <NetAmount amount={a.netActual} currency={cur} /> },
          ]}
        />
      </Section>

      <Section id="categories" title="Kategoriler">
        {categories.length > 0 ? (
          <Table>
            <caption className="sr-only">Bilet kategorileri</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Kategori</TableHead>
                <TableHead scope="col" className="text-right">Satılan</TableHead>
                <TableHead scope="col" className="text-right">Gelir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.category}>
                  <TableCell className="text-foreground">{c.label}</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{c.issued}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-foreground">
                    {formatMoney(c.revenue, cur)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Kategori verisi yok.</p>
        )}
      </Section>

      <Section id="gates" title="Kapılar">
        {gates.length > 0 ? (
          <Table>
            <caption className="sr-only">Kapı dağılımı</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Kapı</TableHead>
                <TableHead scope="col" className="text-right">Bilet</TableHead>
                <TableHead scope="col" className="text-right">Rezervasyon</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gates.map((g) => (
                <TableRow key={g.gate ?? "none"}>
                  <TableCell className="text-foreground">{g.gate === null ? "Kapı belirtilmedi" : `Kapı ${g.gate}`}</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{g.tickets}</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{g.reservations}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Kapı verisi yok.</p>
        )}
      </Section>
    </div>
  );
}
