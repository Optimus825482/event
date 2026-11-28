import { buttonClass } from "@/components/ui/button";
import { CONTACT } from "@/content/site";
import { cn } from "@/lib/cn";

export type Venue = { name: string; address: string };

/** Etkinlik mekânı. Sözleşmede mekân alanı yok; sitenin iletişim bilgisindeki salon kullanılır. */
export function eventVenue(): Venue {
  return { name: CONTACT.venue, address: CONTACT.address };
}

export function venueLinks(venue: Venue): { embed: string; search: string; directions: string } {
  const query = encodeURIComponent(`${venue.name}, ${venue.address}`);
  return {
    embed: `https://www.google.com/maps?q=${query}&output=embed`,
    search: `https://www.google.com/maps/search/?api=1&query=${query}`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
  };
}

/** "Etkinlik Konumu & Ulaşım" bölümü: meritevent.html uyumlu başlık, sağ üstte yol tarifi düğmesi ve koyu tema haritası. */
export function VenueMap({ venue }: { venue: Venue }): React.JSX.Element {
  const links = venueLinks(venue);
  return (
    <section aria-labelledby="konum-baslik" className="mt-11 rounded-[20px] border border-line-gold bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="konum-baslik" className="text-[28px] text-gold-bright">
            Etkinlik Konumu &amp; Ulaşım
          </h2>
          <address className="text-[13.5px] not-italic text-muted">
            <span className="text-ivory">{venue.name}</span> · {venue.address}
          </address>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={links.directions}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonClass("glass"), "min-h-10 border-gold px-4 py-2 text-[13px] text-gold-bright")}
          >
            Google Haritalar&apos;da Yol Tarifi ↗
          </a>
        </div>
      </div>
      <div className="h-[250px] w-full overflow-hidden rounded-[14px] border border-line bg-bg sm:h-[320px]">
        <iframe
          src={links.embed}
          title={`${venue.name} haritası`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="map-dark-filter block h-full w-full border-0"
        />
      </div>
    </section>
  );
}
