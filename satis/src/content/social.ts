/**
 * Sosyal medya ve dış bağlantılar: dış adresler yalnızca bu dosyada tutulur.
 * Adresler prototiplerin (bilet1/bilet2) alt bilgisinde bulunan gerçek hesaplardır; bulunamayanlar boş bırakılır
 * ve alt bilgide çizilmez. Yeni bir hesap açılınca yalnızca `url` doldurulur.
 */
export type SocialNetwork = "instagram" | "facebook" | "youtube" | "tiktok" | "x" | "whatsapp" | "website";

export type SocialLink = {
  network: SocialNetwork;
  /** Ekran okuyucu ve görünen ad. */
  label: string;
  /** Görünen kısa ad (ör. @hesap); boşsa `label` gösterilir. */
  handle: string;
  url: string;
};

export const SOCIAL_LINKS: readonly SocialLink[] = [
  {
    network: "instagram",
    label: "Instagram",
    handle: "@merit.entertainment",
    url: "https://www.instagram.com/merit.entertainment/",
  },
  {
    network: "facebook",
    label: "Facebook",
    handle: "/meritentertainment",
    url: "https://www.facebook.com/meritentertainment/",
  },
  { network: "youtube", label: "YouTube", handle: "", url: "" },
  { network: "tiktok", label: "TikTok", handle: "", url: "" },
  { network: "x", label: "X", handle: "", url: "" },
  { network: "whatsapp", label: "WhatsApp", handle: "", url: "" },
  {
    network: "website",
    label: "Merit Hotels konser sayfası",
    handle: "merithotels.com/konserler",
    url: "https://www.merithotels.com/konserler",
  },
];

/** Adresi dolu olan bağlantılar (alt bilgide yalnızca bunlar çizilir). */
export function activeSocialLinks(links: readonly SocialLink[] = SOCIAL_LINKS): SocialLink[] {
  return links.filter((link) => link.url.startsWith("https://"));
}
