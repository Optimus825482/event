import Link from "next/link";
import { BrandLogoLink } from "@/components/brand-logo";
import { SocialIcon } from "@/components/social-icon";
import { CONTACT, COPYRIGHT, FOOTER_DESCRIPTION, FOOTER_EXPLORE, FOOTER_LEGAL } from "@/content/site";
import { activeSocialLinks } from "@/content/social";

const HEADING = "font-sans text-xs font-bold uppercase tracking-[0.18em] text-gold-bright";
const LINK = "inline-flex items-center py-1 text-[13.5px] text-muted no-underline transition-colors hover:text-ivory";

export function SiteFooter() {
  const socials = activeSocialLinks();
  return (
    <footer className="no-print mt-16 border-t border-line-gold bg-footer">
      <div className="page-gutter mx-auto max-w-[1320px] pt-14 pb-7">
        <div className="grid grid-cols-1 gap-8 border-b border-line pb-9 min-[520px]:grid-cols-2 min-[860px]:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <BrandLogoLink imageClassName="h-[60px]" />
            <p className="max-w-[40ch] text-sm leading-relaxed text-muted">{FOOTER_DESCRIPTION}</p>
          </div>

          <nav aria-label="Keşfet" className="space-y-2">
            <h2 className={HEADING}>Keşfet</h2>
            <ul>
              {FOOTER_EXPLORE.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={LINK}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-2">
            <h2 className={HEADING}>İletişim</h2>
            <address className="space-y-1 text-sm not-italic text-muted">
              <p className="text-ivory">{CONTACT.venue}</p>
              <p>{CONTACT.address}</p>
              <p>
                <a href={CONTACT.phoneHref} className={LINK}>
                  {CONTACT.phone}
                </a>
              </p>
              <p>
                <a href={`mailto:${CONTACT.email}`} className={`${LINK} break-all`}>
                  {CONTACT.email}
                </a>
              </p>
            </address>
          </div>

          {socials.length > 0 ? (
            <nav aria-label="Sosyal Medya" className="space-y-2">
              <h2 className={HEADING}>Sosyal Medya</h2>
              <ul>
                {socials.map((social) => (
                  <li key={social.network}>
                    <a
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${social.label}: ${social.handle || social.label} (yeni sekmede açılır)`}
                      className={`${LINK} gap-2`}
                    >
                      <SocialIcon network={social.network} className="shrink-0 text-gold-bright" />
                      <span>{social.handle || social.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
          <p className="text-xs text-muted">{COPYRIGHT}</p>
          <nav aria-label="Hukuki">
            <ul className="flex flex-wrap gap-x-5">
              {FOOTER_LEGAL.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={`${LINK} text-xs`}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
