import { templateLayoutSchema, type TemplateLayout } from "../schemas";

/**
 * Merit Royal Diamond Ballroom gala krokisi (161 masa × 12 + 12 loca × 6 = 2004 kişi).
 * Koordinatlar krokiden okunmuştur (kroki pikseli); tuvale `SCALE` ile büyütülür.
 * Salon sınırı ince çizgiyle gösterilir (duvar öğesi yok: 3B'de görüntüyü kapatıyordu); alt kenarda üç giriş
 * kapısı için boşluk vardır. İki üst bar ve alt sağ bar sınırın dışındadır. Localar 2. kattadır ve salonun
 * içinde, son masa sırasının üstündedir (altlarında masa vardır).
 */
export const MERIT_BALLROOM_NAME = "Merit Royal Diamond Ballroom (2004 Pax)";
export const MERIT_BALLROOM_DESCRIPTION =
  "Gala krokisi: 161 masa × 12, 12 loca × 6 (2. kat, altında masa), T catwalk'lı sahne, 3 bar, 3 giriş, 2 ekran, sistem kontrol.";

const SCALE = 2;
const TABLE_SIZE = 48;
const LOCA_SIZE = 56;
const s = (v: number) => v * SCALE;

/** [ilk masa numarası, y, x değerleri]: krokideki satırlar. */
const ROWS: ReadonlyArray<readonly [number, number, readonly number[]]> = [
  [1, 113, [88, 135, 182, 231, 281, 633, 683, 733, 784, 835]],
  [11, 152, [106, 154, 206, 257, 304, 620, 669, 720, 773, 822]],
  [21, 192, [93, 142, 191, 241, 291, 626, 675, 720, 768, 817]],
  [31, 237, [112, 161, 208, 260, 309, 362, 412, 512, 560, 611, 662, 715, 767, 816]],
  [45, 276, [111, 160, 211, 259, 309, 363, 412, 520, 570, 621, 669, 718, 766, 817]],
  [59, 322, [131, 180, 225, 271, 317, 364, 565, 612, 659, 708, 758, 805]],
  [71, 370, [119, 166, 215, 265, 315, 368, 417, 466, 517, 568, 618, 668, 718, 769, 815]],
  [86, 410, [120, 167, 217, 268, 321, 373, 428, 480, 529, 576, 620, 669, 718, 768, 817]],
  [101, 462, [135, 187, 238, 288, 334, 383, 433, 483, 531, 580, 630, 681, 732, 782, 829]],
  [116, 508, [126, 174, 220, 269, 319, 367, 416, 465, 517, 566, 615, 665, 715, 763, 810, 856]],
  [132, 555, [100, 147, 193, 242, 293, 340, 384, 587, 636, 688, 740, 791, 843]],
];

/** Satır dışı masalar (krokide renkli): numara -> [x, y]. */
const SINGLES: Readonly<Record<number, readonly [number, number]>> = {
  145: [406, 436],
  146: [458, 436],
  147: [510, 436],
  148: [861, 219],
  149: [856, 262],
  150: [842, 319],
  151: [846, 390],
  152: [858, 181],
  153: [750, 590],
  154: [675, 590],
  155: [307, 590],
  156: [236, 590],
  157: [83, 490],
  158: [66, 290],
  159: [68, 241],
  160: [168, 590],
  161: [110, 590],
};

/** Localar soldan sağa, krokideki adlarıyla; masa numaralarıyla çakışmasın diye L önekli. */
const LOCAS: ReadonlyArray<readonly [string, number]> = [
  ["L9B", 91],
  ["L9A", 157],
  ["L8B", 221],
  ["L8", 291],
  ["L7", 360],
  ["L6", 429],
  ["L5", 496],
  ["L4", 563],
  ["L3B", 632],
  ["L3A", 703],
  ["L2", 770],
  ["L1", 840],
];
/** Son masa sırasının (y = 590) üstünde, salon sınırının içinde. */
const LOCA_Y = 588;

/** Salon sınırı (kroki pikseli). */
const HALL = { left: 45, top: 85, right: 897, bottom: 610 } as const;
/** Salon sınırı, tuval pikseli. */
export const MERIT_BALLROOM_HALL = {
  left: HALL.left * SCALE,
  top: HALL.top * SCALE,
  right: HALL.right * SCALE,
  bottom: HALL.bottom * SCALE,
} as const;

/** Alt kenardaki giriş kapıları: orta noktalar (kroki pikseli) ve genişlik. Yerleri yaklaşıktır (sol, orta, sağ). */
const DOORS = [200, 471, 742] as const;
const DOOR_WIDTH = 60;
const BORDER = { color: "#e2e8f0", width: 4 } as const;

const box = (left: number, top: number, right: number, bottom: number) => ({
  x: s(left),
  y: s(top),
  width: s(right - left),
  height: s(bottom - top),
});

export function meritBallroomLayout(): TemplateLayout {
  const seat = (n: number, x: number, y: number) => ({ label: String(n), capacity: 12, x: s(x), y: s(y), size: TABLE_SIZE, sortNumber: n });
  const tables = [
    ...ROWS.flatMap(([first, y, xs]) => xs.map((x, i) => seat(first + i, x, y))),
    ...Object.entries(SINGLES).map(([n, [x, y]]) => seat(Number(n), x, y)),
  ].sort((a, b) => a.sortNumber - b.sortNumber);
  const locas = LOCAS.map(([label, x]) => ({ label, capacity: 6, x: s(x), y: s(LOCA_Y), isLoca: true, floor: 2, size: LOCA_SIZE }));

  const line = (id: string, x1: number, y1: number, x2: number, y2: number) => ({ id, x1: s(x1), y1: s(y1), x2: s(x2), y2: s(y2), ...BORDER });
  // Alt kenar kapı boşluklarıyla bölünür: [sol uç, kapı 1 başı], [kapı 1 sonu, kapı 2 başı], ...
  const stops = [HALL.left, ...DOORS.flatMap((c) => [c - DOOR_WIDTH / 2, c + DOOR_WIDTH / 2]), HALL.right];
  const lines = [
    line("border-top", HALL.left, HALL.top, HALL.right, HALL.top),
    line("border-left", HALL.left, HALL.top, HALL.left, HALL.bottom),
    line("border-right", HALL.right, HALL.top, HALL.right, HALL.bottom),
    ...Array.from({ length: stops.length / 2 }, (_, i) =>
      line(`border-bottom-${i + 1}`, stops[i * 2] ?? 0, HALL.bottom, stops[i * 2 + 1] ?? 0, HALL.bottom),
    ),
  ];
  const doors = DOORS.map((c, i) => ({
    id: `door-${i + 1}`,
    kind: "area" as const,
    ...box(c - DOOR_WIDTH / 2, HALL.bottom - 6, c + DOOR_WIDTH / 2, HALL.bottom + 8),
    label: `GİRİŞ ${i + 1}`,
    color: "#22d3ee",
    fontSize: "sm" as const,
  }));
  const elements = [
    { id: "stage", kind: "stage" as const, ...box(345, 113, 584, 213), label: "SAHNE", color: "#eab308" },
    { id: "catwalk-stem", kind: "catwalk" as const, ...box(442, 213, 480, 318), label: "", color: "#65a30d" },
    { id: "catwalk-cross", kind: "catwalk" as const, ...box(391, 316, 536, 352), label: "", color: "#65a30d" },
    { id: "title", kind: "label" as const, ...box(345, 90, 584, 110), label: "Merit Royal Diamond Ballroom", color: "#e2e8f0" },
    { id: "screen-left", kind: "area" as const, ...box(49, 308, 79, 452), label: "EKRAN", color: "#eab308", textDirection: "vertical-down" as const },
    { id: "screen-right", kind: "area" as const, ...box(863, 316, 893, 460), label: "EKRAN", color: "#eab308", textDirection: "vertical-down" as const },
    { id: "system-control", kind: "stage" as const, ...box(415, 537, 556, 603), label: "SYSTEM KONTROL", color: "#16a34a", fontSize: "sm" as const },
    { id: "bar-1", kind: "bar" as const, ...box(35, 20, 117, 78), label: "BAR 1", color: "#b45309" },
    { id: "bar-2", kind: "bar" as const, ...box(813, 20, 897, 78), label: "BAR 2", color: "#b45309" },
    { id: "bar-3", kind: "bar" as const, ...box(778, 698, 907, 755), label: "BAR 3", color: "#b45309" },
    ...doors,
    { id: "loca-title", kind: "label" as const, ...box(409, 624, 533, 642), label: "LOCA (2. KAT)", color: "#f472b6" },
  ];
  return templateLayoutSchema.parse({ version: 1, tables: [...tables, ...locas], decor: { width: 1900, height: 1560, elements, lines } });
}

/**
 * `drizzle/0011_update_merit_ballroom_template.sql` içeriği: şablon canlıya dağıtımdaki migration adımıyla gelir.
 * Sahipsiz hazır şablonu (0010'un eklediği satır) bu yerleşimle günceller; satır yoksa ekler. Bir kullanıcının
 * sahiplendiği aynı adlı şablona dokunulmaz. Yerleşim yeniden değişirse yeni bir migration yazılır; uygulanmış
 * migration dosyası (0010 dahil) değiştirilmez.
 */
export function meritBallroomMigrationSql(): string {
  const q = (text: string) => `$seed$${text}$seed$`;
  const layout = `${q(JSON.stringify(meritBallroomLayout()))}::jsonb`;
  return [
    "-- Elle yazılmış veri migration'ı: Merit Royal Diamond Ballroom hazır şablonunu günceller (duvarsız sınır,",
    "-- salonun içinde localar, 3 giriş). İçerik src/features/venue/presets/merit-ballroom.ts dosyasından üretilir;",
    "-- eşitliği testle korunur.",
    `UPDATE "venue_templates" SET "description" = ${q(MERIT_BALLROOM_DESCRIPTION)}, "layout_data" = ${layout}`,
    `WHERE "name" = ${q(MERIT_BALLROOM_NAME)} AND "created_by_id" IS NULL;`,
    "--> statement-breakpoint",
    'INSERT INTO "venue_templates" ("name", "description", "layout_data", "is_public")',
    `SELECT ${q(MERIT_BALLROOM_NAME)}, ${q(MERIT_BALLROOM_DESCRIPTION)}, ${layout}, true`,
    `WHERE NOT EXISTS (SELECT 1 FROM "venue_templates" WHERE "name" = ${q(MERIT_BALLROOM_NAME)});`,
    "",
  ].join("\n");
}
