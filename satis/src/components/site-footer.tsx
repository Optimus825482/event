import Link from "next/link";
import {
  CONTACT,
  COPYRIGHT,
  FOOTER_DESCRIPTION,
  FOOTER_EXPLORE,
  FOOTER_LEGAL,
  SITE_NAME,
} from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="no-print mt-16 border-t border-line-gold bg-footer">
      <div className="page-gutter mx-auto max-w-[1320px] py-12">
        <div className="grid grid-cols-1 gap-8 min-[520px]:grid-cols-2 min-[860px]:grid-cols-4">
          <div className="space-y-3">
            <h2 className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-gold-bright">
              {SITE_NAME}
            </h2>
            <p className="text-sm leading-relaxed text-muted">{FOOTER_DESCRIPTION}</p>
          </div>

          <nav aria-label="Keşfet" className="space-y-2">
            <h2 className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-gold-bright">Keşfet</h2>
            <ul className="space-y-1">
              {FOOTER_EXPLORE.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 items-center text-sm text-muted no-underline transition-colors hover:text-ivory"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-2">
            <h2 className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-gold-bright">İletişim</h2>
            <div className="space-y-1 text-sm text-muted">
              <p className="text-ivory">{CONTACT.venue}</p>
              <p>{CONTACT.address}</p>
              <p>
                <a
                  href={CONTACT.phoneHref}
                  className="inline-flex min-h-11 items-center text-muted no-underline transition-colors hover:text-ivory"
                >
                  {CONTACT.phone}
                </a>
              </p>
              <p>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="inline-flex min-h-11 items-center text-muted no-underline transition-colors hover:text-ivory"
                >
                  {CONTACT.email}
                </a>
              </p>
            </div>
          </div>

          <nav aria-label="Hukuki" className="space-y-2">
            <h2 className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-gold-bright">Hukuki</h2>
            <ul className="space-y-1">
              {FOOTER_LEGAL.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 items-center text-sm text-muted no-underline transition-colors hover:text-ivory"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-10 border-t border-line pt-6 text-xs text-muted">{COPYRIGHT}</p>
      </div>
    </footer>
  );
}
