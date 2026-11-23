import type {
  DecorElement,
  DecorFontFamily,
  DecorFontSize,
  DecorIcon,
  DecorKind,
  DecorTextDirection,
} from "../schemas";

export const FILL_SWATCHES = [
  { label: "Kırmızı", color: "#ef4444" },
  { label: "Turuncu", color: "#f97316" },
  { label: "Sarı", color: "#f59e0b" },
  { label: "Yeşil", color: "#22c55e" },
  { label: "Turkuaz", color: "#14b8a6" },
  { label: "Mavi", color: "#3b82f6" },
  { label: "Mor", color: "#8b5cf6" },
  { label: "Pembe", color: "#ec4899" },
  { label: "Gri", color: "#64748b" },
] as const;

export const BORDER_SWATCHES = [
  { label: "Beyaz", color: "#ffffff" },
  { label: "Siyah", color: "#000000" },
  { label: "Kırmızı", color: "#f87171" },
  { label: "Turuncu", color: "#fb923c" },
  { label: "Sarı", color: "#fbbf24" },
  { label: "Yeşil", color: "#4ade80" },
  { label: "Turkuaz", color: "#2dd4bf" },
  { label: "Mavi", color: "#60a5fa" },
  { label: "Mor", color: "#a78bfa" },
  { label: "Pembe", color: "#f472b6" },
  { label: "Gri", color: "#94a3b8" },
] as const;

export const ICON_OPTIONS: ReadonlyArray<{ id: DecorIcon; label: string }> = [
  { id: "none", label: "Yok" },
  { id: "mic", label: "Mikrofon" },
  { id: "footprints", label: "Catwalk" },
  { id: "utensils", label: "Yemek" },
  { id: "settings", label: "Kontrol" },
  { id: "users", label: "Kişiler" },
  { id: "box", label: "Kutu" },
  { id: "star", label: "Yıldız" },
];

/** 24x24 çizgi simgeleri (Konva `Path` ve satır içi SVG ortak kullanır). */
export const ICON_PATHS: Record<Exclude<DecorIcon, "none">, string> = {
  mic: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v3",
  footprints: "M8 3c-2 0-3 2-3 5s1 4 3 4 3-1 3-4-1-5-3-5Z M16 11c-2 0-3 2-3 5s1 5 3 5 3-2 3-5-1-5-3-5Z",
  utensils: "M7 3v8 M4 3v5a3 3 0 0 0 6 0V3 M7 11v10 M17 21V3c-2 1-3 4-3 8h3",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M19 5l-2 2 M7 17l-2 2",
  users: "M9 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M3 20c0-3 3-5 6-5s6 2 6 5 M17 8a2.5 2.5 0 1 1 0 5 M18 15c2 .5 3 2.5 3 5",
  box: "M21 8 12 3 3 8v8l9 5 9-5Z M3 8l9 5 9-5 M12 13v8",
  star: "M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9Z",
};

export const FONT_SIZE_OPTIONS: ReadonlyArray<{ id: DecorFontSize; label: string; px: number }> = [
  { id: "sm", label: "S", px: 12 },
  { id: "md", label: "M", px: 16 },
  { id: "lg", label: "L", px: 20 },
  { id: "xl", label: "XL", px: 26 },
];

export const FONT_FAMILY_OPTIONS: ReadonlyArray<{ id: DecorFontFamily; label: string; css: string }> = [
  { id: "sans", label: "Sans", css: "system-ui, sans-serif" },
  { id: "roboto", label: "Roboto", css: "Roboto, Arial, sans-serif" },
  { id: "playfair", label: "Playfair", css: "'Playfair Display', Georgia, serif" },
  { id: "oswald", label: "Oswald", css: "Oswald, Impact, sans-serif" },
];

export const TEXT_DIRECTION_OPTIONS: ReadonlyArray<{ id: DecorTextDirection; label: string }> = [
  { id: "horizontal", label: "↔ Yatay" },
  { id: "vertical-down", label: "↓ Dikey ↓" },
  { id: "vertical-up", label: "↑ Dikey ↑" },
];

export const BORDER_WIDTHS = [1, 2, 3, 4, 5, 6] as const;

export type ResolvedDecorStyle = {
  fill: string;
  border: string;
  borderWidth: number;
  fontPx: number;
  fontCss: string;
  direction: DecorTextDirection;
  icon: Exclude<DecorIcon, "none"> | null;
  /** Dolgu saydamlığı (alan daha şeffaf, sahne daha dolgun). */
  opacity: number;
};

const DEFAULT_FILL = "#64748b";

type StyleInput = Pick<
  DecorElement,
  "kind" | "color" | "borderColor" | "borderWidth" | "icon" | "fontSize" | "fontFamily" | "textDirection"
>;

/** Alanları varsayılanlarla birleştirir; eski kayıtlarda (yeni alanlar yok) önceki görünüm korunur. */
export function resolveDecorStyle(e: StyleInput): ResolvedDecorStyle {
  const fill = e.color ?? DEFAULT_FILL;
  const defaultPx = e.kind === "label" ? 18 : 16;
  return {
    fill,
    border: e.borderColor ?? fill,
    borderWidth: e.borderWidth ?? 1,
    fontPx: FONT_SIZE_OPTIONS.find((o) => o.id === e.fontSize)?.px ?? defaultPx,
    fontCss: (FONT_FAMILY_OPTIONS.find((o) => o.id === e.fontFamily)?.css ?? FONT_FAMILY_OPTIONS[0]?.css ?? "sans-serif"),
    direction: e.textDirection ?? "horizontal",
    icon: e.icon && e.icon !== "none" ? e.icon : null,
    opacity: e.kind === "area" ? 0.3 : e.kind === "stage" || e.kind === "catwalk" ? 0.75 : 1,
  };
}

export const DECOR_KIND_TITLE: Record<DecorKind, string> = {
  stage: "Sahne",
  area: "Alan",
  wall: "Duvar",
  label: "Metin",
  bar: "Bar / Hizmet Noktası",
  catwalk: "Catwalk (Podyum)",
};

/** Tam stil bölümü (çerçeve, simge, yazı tipi, yön) metin ve duvar dışındaki türler için sunulur. */
export function supportsFullStyle(kind: DecorKind): boolean {
  return kind !== "label" && kind !== "wall";
}
