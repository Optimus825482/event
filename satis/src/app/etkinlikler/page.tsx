import type { Metadata } from "next";
import { UpcomingList } from "@/components/events/upcoming-list";
import { Notice } from "@/components/ui/notice";
import { SITE_NAME } from "@/content/site";
import { loadEvents } from "../_lib/load-events";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Yaklaşan Etkinlikler",
};

export default async function UpcomingEventsPage() {
  const result = await loadEvents();

  return (
    <main className="page-gutter mx-auto max-w-[1320px] py-12">
      <div className="mb-8 space-y-2">
        <p className="eyebrow">{SITE_NAME}</p>
        <h1 className="text-[clamp(34px,5vw,56px)] text-ivory">Yaklaşan Etkinlikler</h1>
      </div>

      {"error" in result ? (
        <Notice tone="error">{result.error}</Notice>
      ) : result.events.length === 0 ? (
        <Notice>Şu anda satışta etkinlik yok.</Notice>
      ) : (
        <UpcomingList events={result.events} />
      )}
    </main>
  );
}
