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

/** "Konum" bölümü: Google Haritalar gömülü harita, mekân adı/adresi, yol tarifi ve haritada açma bağlantıları. */
export function VenueMap({ venue }: { venue: Venue }): React.JSX.Element {
  const links = venueLinks(venue);
  return (
    <section aria-labelledby="konum-baslik" className="space-y-4 rounded-[20px] border border-line-gold bg-surface p-6">
      <h2 id="konum-baslik" className="text-[clamp(30px,4vw,44px)] text-ivory">
        Konum
      </h2>
      <div className="overflow-hidden rounded-[14px] border border-line bg-bg">
        <iframe
          src={links.embed}
          title={`${venue.name} haritası`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block aspect-[16/9] max-h-[440px] w-full border-0"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <address className="not-italic">
          <p className="text-base font-semibold text-ivory">{venue.name}</p>
          <p className="text-sm text-muted">{venue.address}</p>
        </address>
        <div className="flex flex-wrap gap-2.5">
          <a href={links.directions} target="_blank" rel="noopener noreferrer" className={buttonClass("gold")}>
            Yol tarifi al
          </a>
          <a href={links.search} target="_blank" rel="noopener noreferrer" className={cn(buttonClass("glass"))}>
            Google Haritalar&apos;da aç
          </a>
        </div>
      </div>
    </section>
  );
}
