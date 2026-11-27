export const SITE_TABS = ["icerik", "siparisler"] as const;
export type SiteTab = (typeof SITE_TABS)[number];

export function parseSiteTab(raw: string | readonly string[] | undefined, canSeeOrders: boolean): SiteTab {
  return raw === "siparisler" && canSeeOrders ? "siparisler" : "icerik";
}
