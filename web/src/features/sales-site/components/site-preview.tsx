import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { SiteContentView } from "../content-service";

export function SitePreview({ view }: { view: SiteContentView }) {
  const snippet = view.summary ? view.summary.slice(0, 160) : null;

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-sm font-medium text-muted-foreground">Sitede görünüm (önizleme)</h2>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="w-full shrink-0 sm:w-44">
          {view.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/uploads/${view.coverImage}`}
              alt={view.eventName}
              className="aspect-[3/4] w-full rounded border object-cover"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Kapak görseli yok</p>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{view.eventName}</h3>
          <p className="text-xs text-muted-foreground">{formatDate(view.startsAt)}</p>
          {snippet ? <p className="text-sm text-muted-foreground">{snippet}</p> : null}
          <div className="flex flex-wrap gap-2">
            {view.ageLimit ? <Badge variant="outline">{view.ageLimit}</Badge> : null}
            {view.dressCode ? <Badge variant="outline">{view.dressCode}</Badge> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
