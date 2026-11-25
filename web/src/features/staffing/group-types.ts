/** Masa grubu tipleri: loca grubu yalnızca loca masalarını, standart grup loca olmayanları içerir. */
export const GROUP_TYPES = ["standard", "loca"] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

export const GROUP_TYPE_LABELS: Record<GroupType, string> = { standard: "Standart", loca: "Loca" };
