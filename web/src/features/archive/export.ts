import type { Db } from "@/db/client";
import { ForbiddenError } from "@/features/auth/errors";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { dateToZonedWallClock } from "@/lib/time-zone";
import { formatDate } from "@/lib/utils";
import { getArchiveView, type ArchiveSummary } from "./read";
import { buildWorkbook, moneyCell, type SheetSpec } from "./xlsx";

export type ExportResult =
  | { ok: true; bytes: Uint8Array; filename: string }
  | { ok: false; status: 400 | 401 | 403 | 404; message: string };

export const NO_SESSION: ExportResult = { ok: false, status: 401, message: "Oturum gerekli" };

/** Servis hatalarını dışa aktarım sonucuna eşler; tanınmayan hata yeniden fırlatılır. */
export function exportFailure(error: unknown): ExportResult {
  if (error instanceof ForbiddenError) return { ok: false, status: 403, message: "Bu işlem için yetkiniz yok" };
  if (error instanceof DomainError && error.code === "not_found") {
    return { ok: false, status: 404, message: error.message };
  }
  throw error;
}

export function archiveSheets(view: ArchiveSummary): SheetSpec[] {
  const money = (v: string | null) => moneyCell(v);
  const summary: [string, string | number | null][] = [
    ["Etkinlik", view.eventName],
    ["Tarih", formatDate(view.startsAt, "datetime")],
    ["Etkinlik türü", view.eventType],
    ["Sanatçı", view.artistName],
    ["Para birimi", view.currency],
    ["Sürüm", view.revision],
    ["Arşivlenme", formatDate(view.archivedAt, "datetime")],
    ["Masa sayısı", view.tableCount],
    ["Toplam kapasite", view.totalCapacity],
    ["Casino masa", view.casinoTableCount],
    ["Casino sandalye", view.casinoSeatCount],
    ["Online masa", view.onlineTableCount],
    ["Satılabilir sandalye", view.sellableSeatCount],
    ["Satılan bilet", view.ticketsSold],
    ["Bilet geliri", money(view.ticketRevenue)],
    ["Demo bilet (gerçek ödeme alınmadı)", view.demoTicketsSold],
    ["Demo bilet geliri (gerçek ödeme alınmadı)", money(view.demoTicketRevenue)],
    ["Giriş yapan bilet", view.ticketsCheckedIn],
    ["Rezervasyon", view.reservationCount],
    ["Giriş yapan rezervasyon", view.reservationsCheckedIn],
    ["No-show rezervasyon", view.reservationsNoShow],
    ["Beklenen misafir", view.guestsExpected],
    ["Giriş yapan misafir", view.guestsCheckedIn],
    ["F&B personel", view.fnbStaffCount],
    ["Sanatçı ücreti", money(view.artistFee)],
    ["Tahmini gider", money(view.estimatedExpense)],
    ["Gerçekleşen gider", money(view.actualExpense)],
    ["Tahmini diğer gelir", money(view.estimatedOtherIncome)],
    ["Gerçekleşen diğer gelir", money(view.actualOtherIncome)],
    ["Net (gerçekleşen)", money(view.netActual)],
    ["Doluluk %", view.rates.occupancy],
    ["Katılım %", view.rates.attendance],
    ["No-show %", view.rates.noShow],
  ];
  // "Değer" sütunu adet, para ve yüzde karışıktır; sütun biçimi uygulanmaz (para yine sayı hücresidir).
  return [
    { name: "Özet", headers: ["Alan", "Değer"], rows: summary },
    {
      name: "Kategoriler",
      headers: ["Kategori", "Satılan bilet", "Gelir"],
      rows: view.details.categories.map((c) => [c.label, c.issued, money(c.revenue)]),
      moneyColumns: [3],
    },
    {
      name: "Finans kalemleri",
      headers: ["Yön", "Kategori", "Kalem", "Tahmini", "Gerçekleşen"],
      rows: view.details.financeItems.map((f) => [
        f.direction === "expense" ? "Gider" : "Gelir",
        f.category,
        f.label,
        money(f.estimatedAmount),
        money(f.actualAmount),
      ]),
      moneyColumns: [4, 5],
    },
    {
      name: "Kapılar",
      headers: ["Kapı", "Bilet", "Rezervasyon"],
      rows: view.details.gates.map((g) => [g.gate ?? "Belirtilmemiş", g.tickets, g.reservations]),
    },
  ];
}

/** Arşiv kaydını Excel'e aktarır; `archive:view` gerekir. */
export async function exportArchive(db: Db, actor: Actor | null, eventId: string): Promise<ExportResult> {
  if (!actor) return NO_SESSION;
  try {
    const view = await getArchiveView(db, actor, eventId);
    const day = dateToZonedWallClock(view.startsAt).slice(0, 10);
    return { ok: true, bytes: await buildWorkbook(archiveSheets(view)), filename: `arsiv-${day}.xlsx` };
  } catch (error) {
    return exportFailure(error);
  }
}
