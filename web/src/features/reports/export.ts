import type { Db } from "@/db/client";
import { exportFailure, NO_SESSION, type ExportResult } from "@/features/archive/export";
import { buildWorkbook, moneyCell, type SheetSpec } from "@/features/archive/xlsx";
import type { Actor } from "@/features/auth/session";
import { formatDate } from "@/lib/utils";
import { periodSchema } from "./period";
import { getPeriodReport, type PeriodReport } from "./service";

export function periodSheets(report: PeriodReport): SheetSpec[] {
  const money = (v: string | null) => moneyCell(v);
  return [
    {
      name: "Dönem raporu",
      headers: [
        "Etkinlik", "Tarih", "Sanatçı", "Tür", "Para birimi", "Satılabilir sandalye", "Satılan bilet", "Demo bilet",
        "Bilet geliri", "Demo bilet geliri", "Sanatçı ücreti", "Tahmini gider", "Gerçekleşen gider",
        "Tahmini diğer gelir", "Gerçekleşen diğer gelir", "Net (gerçekleşen)", "Casino masa", "Rezervasyon",
        "No-show", "Beklenen misafir", "Giriş yapan misafir", "Giriş yapan bilet", "F&B personel", "Doluluk %",
        "Katılım %", "No-show %",
      ],
      rows: report.rows.map((r) => [
        r.eventName,
        formatDate(r.startsAt, "datetime"),
        r.artistName,
        r.eventType,
        r.currency,
        r.sellableSeatCount,
        r.ticketsSold,
        r.demoTicketsSold,
        money(r.ticketRevenue),
        money(r.demoTicketRevenue),
        money(r.artistFee),
        money(r.estimatedExpense),
        money(r.actualExpense),
        money(r.estimatedOtherIncome),
        money(r.actualOtherIncome),
        money(r.netActual),
        r.casinoTableCount,
        r.reservationCount,
        r.reservationsNoShow,
        r.guestsExpected,
        r.guestsCheckedIn,
        r.ticketsCheckedIn,
        r.fnbStaffCount,
        r.rates.occupancy,
        r.rates.attendance,
        r.rates.noShow,
      ]),
      moneyColumns: [9, 10, 11, 12, 13, 14, 15, 16],
    },
    {
      name: "Toplamlar",
      headers: [
        "Para birimi", "Etkinlik sayısı", "Satılan bilet", "Demo bilet", "Bilet geliri", "Demo bilet geliri",
        "Sanatçı ücreti", "Gerçekleşen gider", "Gerçekleşen diğer gelir", "Net (gerçekleşen)", "Doluluk %",
        "Katılım %", "No-show %",
      ],
      rows: report.totals.map((t) => [
        t.currency,
        t.eventCount,
        t.ticketsSold,
        t.demoTicketsSold,
        money(t.ticketRevenue),
        money(t.demoTicketRevenue),
        money(t.artistFee),
        money(t.actualExpense),
        money(t.actualOtherIncome),
        money(t.netActual),
        t.rates.occupancy,
        t.rates.attendance,
        t.rates.noShow,
      ]),
      moneyColumns: [5, 6, 7, 8, 9, 10],
    },
  ];
}

/** Dönem raporunu Excel'e aktarır; `archive:view` gerekir. Girdi önce `periodSchema` ile doğrulanır. */
export async function exportPeriodReport(
  db: Db,
  actor: Actor | null,
  params: { from?: string | null; to?: string | null },
): Promise<ExportResult> {
  if (!actor) return NO_SESSION;
  const parsed = periodSchema.safeParse({ from: params.from ?? "", to: params.to ?? "" });
  if (!parsed.success) {
    return { ok: false, status: 400, message: parsed.error.issues[0]?.message ?? "Geçerli bir tarih girin" };
  }
  try {
    const report = await getPeriodReport(db, actor, parsed.data);
    return {
      ok: true,
      bytes: await buildWorkbook(periodSheets(report)),
      filename: `donem-raporu-${parsed.data.from}_${parsed.data.to}.xlsx`,
    };
  } catch (error) {
    return exportFailure(error);
  }
}
