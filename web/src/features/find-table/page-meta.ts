import type { Metadata } from "next";

/** Belirteçli URL arama motoruna ve Referer üstbilgisiyle üçüncü taraflara sızmaz. */
export const FIND_TABLE_METADATA: Metadata = {
  title: "Masamı bul",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
