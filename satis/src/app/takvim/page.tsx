import type { Metadata } from "next";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { Notice } from "@/components/ui/notice";
import { SITE_NAME } from "@/content/site";
import { loadEvents } from "../_lib/load-events";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Etkinlik Takvimi",
};

export default async function CalendarPage() {
  const result = await loadEvents();

  return (
    <main className="page-gutter mx-auto max-w-[1320px] py-10 pb-[72px]">
      <div className="mb-5 space-y-2.5">
        <p className="eyebrow">{`${SITE_NAME} · 2026`}</p>
        <h1 className="text-[clamp(34px,5vw,56px)] text-ivory">2026 Konser &amp; Gala Takvimi</h1>
      </div>

      {"error" in result ? <Notice tone="error">{result.error}</Notice> : <CalendarGrid events={result.events} />}
    </main>
  );
}
