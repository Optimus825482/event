export const SITE_NAME = "Merit Entertainment";
export const SITE_TAGLINE = "Konser & Gala Biletleri";

export const NAV_ITEMS = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/etkinlikler", label: "Yaklaşan Etkinlikler" },
  { href: "/takvim", label: "Takvim" },
  { href: "/biletimi-bul", label: "Biletim (PNR)" },
  { href: "/hakkimizda", label: "Hakkımızda" },
] as const;

export const NAV_CTA = { href: "/etkinlikler", label: "Bilet Al" } as const;

export const FOOTER_DESCRIPTION =
  "Kuzey Kıbrıs'ın en prestijli gala salonlarında dünya standartlarında sahne prodüksiyonları ve unutulmaz konser geceleri.";

export const FOOTER_EXPLORE = [
  ...NAV_ITEMS,
  { href: "/sss", label: "Sık Sorulan Sorular" },
  { href: "/iade", label: "İade Koşulları" },
] as const;

export const FOOTER_LEGAL = [
  { href: "/kvkk", label: "KVKK" },
  { href: "/mesafeli-satis", label: "Mesafeli Satış" },
] as const;

export const CONTACT = {
  venue: "Merit Royal Diamond Hotel & Spa",
  address: "Alsancak, Girne / KKTC",
  phone: "+90 392 650 40 00",
  phoneHref: "tel:+903926504000",
  email: "entertainment@merithotels.com",
} as const;

export const COPYRIGHT = "© 2026 Merit Entertainment. Tüm hakları saklıdır.";

export function isCurrentPath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
