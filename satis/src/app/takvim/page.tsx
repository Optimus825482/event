import type { Metadata } from "next";
import { defaultMonth, parseMonthParam } from "@/components/calendar/month";
import { MonthView } from "@/components/calendar/month-view";
import { Notice } from "@/components/ui/notice";
import { SITE_NAME } from "@/content/site";
import { todayKey } from "@/lib/time-zone";
import { loadEvents } from "../_lib/load-events";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Takvim",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string | string[] }>;
}) {
  const [{ ay }, result] = await Promise.all([searchParams, loadEvents()]);

  return (
    <main className="page-gutter mx-auto max-w-[1320px] py-12">
      <div className="mb-8 space-y-2">
        <p className="eyebrow">{SITE_NAME}</p>
        <h1 className="text-[clamp(34px,5vw,56px)] text-ivory">Etkinlik Takvimi</h1>
      </div>

      {"error" in result ? (
        <Notice tone="error">{result.error}</Notice>
      ) : (
        <MonthView month={parseMonthParam(ay) ?? defaultMonth(result.events, todayKey())} events={result.events} />
      )}
    </main>
  );
}
