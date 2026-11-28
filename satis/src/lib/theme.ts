/** Renk token'ları: bileşenler yalnızca bunlardan (Tailwind `--color-*` değişkenleri üzerinden) renk alır. */
export const COLORS = {
  bg: "#08090d",
  surface: "#11131a",
  surfaceRaised: "#161923",
  footer: "#06070a",
  line: "#24262c",
  lineGold: "#352e16",
  selection: "#60a5fa",
  gold: "#d4af37",
  goldBright: "#f0d068",
  ivory: "#f7f5f0",
  muted: "#a6aab8",
  onGold: "#08090d",
  glass: "#252013",
  danger: "#fda4af",
  success: "#34d399",
  disabledBg: "#24262c",
  disabledText: "#a6aab8",
} as const;

export type ColorName = Exclude<keyof typeof COLORS, "footer" | "lineGold">;

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
export const TEXT_PAIRS: readonly { fg: keyof typeof COLORS; bg: keyof typeof COLORS }[] = [
  { fg: "ivory", bg: "bg" },
  { fg: "ivory", bg: "surface" },
  { fg: "ivory", bg: "surfaceRaised" },
  { fg: "ivory", bg: "footer" },
  { fg: "ivory", bg: "glass" },
  { fg: "muted", bg: "bg" },
  { fg: "muted", bg: "surface" },
  { fg: "muted", bg: "surfaceRaised" },
  { fg: "muted", bg: "footer" },
  { fg: "gold", bg: "bg" },
  { fg: "gold", bg: "surface" },
  { fg: "gold", bg: "surfaceRaised" },
  { fg: "gold", bg: "glass" },
  { fg: "goldBright", bg: "bg" },
  { fg: "goldBright", bg: "surface" },
  { fg: "goldBright", bg: "surfaceRaised" },
  { fg: "goldBright", bg: "footer" },
  { fg: "onGold", bg: "gold" },
  { fg: "onGold", bg: "goldBright" },
  { fg: "danger", bg: "bg" },
  { fg: "danger", bg: "surface" },
  { fg: "success", bg: "bg" },
  { fg: "success", bg: "surface" },
  { fg: "disabledText", bg: "disabledBg" },
];
