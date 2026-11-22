/** Bu puan ve üzeri (ya da "VIP" etiketi) müşteriyi VIP sayar; hem istatistik hem arayüz aynı eşiği kullanır. */
export const VIP_SCORE_THRESHOLD = 70;

export type VipTier = { label: string; className: string };

/** Puana göre VIP seviyesi (müşteri ayrıntı başlığı). */
export function vipTier(score: number): VipTier {
  if (score >= VIP_SCORE_THRESHOLD) return { label: "VIP", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
  if (score >= 40) return { label: "Sadık", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  return { label: "Standart", className: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
}

const FOLD: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };

function fold(tag: string): string {
  return tag
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (c) => FOLD[c] ?? c)
    .replace(/[\s_-]+/g, " ")
    .trim();
}

type TagStyle = { label?: string; className: string };

const TAG_STYLES: ReadonlyArray<{ match: readonly string[]; style: TagStyle }> = [
  { match: ["vip"], style: { className: "bg-yellow-600/20 text-yellow-400 border-yellow-500/30" } },
  { match: ["vegan"], style: { className: "bg-green-600/20 text-green-400 border-green-500/30" } },
  { match: ["sahne onu", "sahne onu sever"], style: { label: "Sahne Önü", className: "bg-purple-600/20 text-purple-400 border-purple-500/30" } },
  { match: ["bahsis", "bahsis birakir"], style: { label: "Bahşiş", className: "bg-blue-600/20 text-blue-400 border-blue-500/30" } },
  { match: ["dikkat", "sorunlu"], style: { label: "Dikkat", className: "bg-red-600/20 text-red-400 border-red-500/30" } },
];

const DEFAULT_TAG_CLASS = "bg-slate-600/20 text-slate-300 border-slate-500/30";

/** Eski arayüzün etiket paleti (VIP, Vegan, Sahne Önü, Bahşiş, Dikkat); bilinmeyen etiket nötr gri. */
export function tagStyle(tag: string): { label: string; className: string } {
  const key = fold(tag);
  const hit = TAG_STYLES.find((entry) => entry.match.includes(key));
  return { label: hit?.style.label ?? tag, className: hit?.style.className ?? DEFAULT_TAG_CLASS };
}
