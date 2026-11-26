/** Renk token'ları: bileşenler yalnızca bunlardan (Tailwind `--color-*` değişkenleri üzerinden) renk alır. */
export const COLORS = {
  bg: "#0b1220",
  surface: "#141b2d",
  surfaceRaised: "#1c2540",
  line: "#2a3555",
  gold: "#d4af37",
  goldBright: "#e6c558",
  ivory: "#f4f0e8",
  muted: "#b9ae9a",
  onGold: "#141b2d",
  glass: "#262c3c",
  danger: "#ff8a80",
  success: "#7fd1a3",
  disabledBg: "#2a3555",
  disabledText: "#b9ae9a",
} as const;

export type ColorName = keyof typeof COLORS;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG 2.x kontrast oranı (1–21). */
export function contrastRatio(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Metin taşıyan renk çiftleri; hepsi en az 4.5:1 olmalıdır (test zorlar). */
export const TEXT_PAIRS: readonly { fg: ColorName; bg: ColorName }[] = [
  { fg: "ivory", bg: "bg" },
  { fg: "ivory", bg: "surface" },
  { fg: "ivory", bg: "surfaceRaised" },
  { fg: "ivory", bg: "glass" },
  { fg: "muted", bg: "bg" },
  { fg: "muted", bg: "surface" },
  { fg: "gold", bg: "bg" },
  { fg: "gold", bg: "surface" },
  { fg: "gold", bg: "surfaceRaised" },
  { fg: "gold", bg: "glass" },
  { fg: "onGold", bg: "gold" },
  { fg: "onGold", bg: "goldBright" },
  { fg: "danger", bg: "surface" },
  { fg: "success", bg: "surface" },
  { fg: "disabledText", bg: "disabledBg" },
];
