import type { ShellGroup, ShellItem } from "./shell-nav";

export function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Yola en uzun önekle uyan modül; hiçbiri uymazsa ilk modül (ör. ana sayfa, bildirimler). */
export function findActiveGroup(groups: readonly ShellGroup[], pathname: string): ShellGroup | undefined {
  let best: { group: ShellGroup; length: number } | undefined;
  for (const group of groups) {
    const prefixes = [...group.items.map((i) => i.href), ...group.extraPrefixes];
    for (const prefix of prefixes) {
      if (pathMatches(pathname, prefix) && (!best || prefix.length > best.length)) {
        best = { group, length: prefix.length };
      }
    }
  }
  return best?.group ?? groups[0];
}

/**
 * Bir öğe, yola tam uyduğunda ya da yolun öncülü olduğu hâlde daha uzun bir kardeş öğe
 * (ör. /leader ve /leader/events) yola uymuyorsa etkindir.
 */
export function isItemActive(pathname: string, item: ShellItem, siblings: readonly ShellItem[] = []): boolean {
  if (!pathMatches(pathname, item.href)) return false;
  if (pathname === item.href) return true;
  return !siblings.some((other) => other.href.length > item.href.length && pathMatches(pathname, other.href));
}

const ID_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

const ROUTE_LABELS: Record<string, string> = {
  events: "Etkinlikler",
  new: "Yeni",
  venue: "Yerleşim Planı",
  "team-organization": "Ekip Organizasyonu",
  invitation: "Davetiye",
  reservations: "Rezervasyonlar",
  guests: "Misafirler",
  customers: "Müşteriler",
  "check-in": "Check-in",
  staff: "Ekipler",
  venues: "Şablonlar",
  templates: "Davetiye Şablonları",
  leader: "Lider",
  reviews: "Değerlendirmeler",
  notifications: "Bildirimler",
  admin: "Yönetim",
  users: "Kullanıcılar",
  settings: "Ayarlar",
  "table-types": "Masa Tipleri",
  organization: "Organizasyon",
  import: "İçe Aktarma",
  assignments: "Atamalar",
  template: "Şablon",
};

export type Crumb = { label: string; href: string | null };

function humanize(segment: string): string {
  const text = decodeURIComponent(segment).replace(/-/g, " ");
  return text.charAt(0).toLocaleUpperCase("tr-TR") + text.slice(1);
}

/**
 * Yoldan kırıntı üretir. Kimlik segmenti "Detay" olur; yalnızca gerçek bir sayfaya çıkan
 * (menü yolu ya da kimlikli detay) ara kırıntılar bağlantı olur, sonuncusu bağlantısızdır.
 */
export function buildCrumbs(pathname: string, linkable: ReadonlySet<string>): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const isId = ID_SEGMENT.test(segment);
    const isLast = index === segments.length - 1;
    const label = isId ? "Detay" : (ROUTE_LABELS[segment] ?? humanize(segment));
    crumbs.push({ label, href: !isLast && (isId || linkable.has(href)) ? href : null });
  });
  return crumbs;
}
