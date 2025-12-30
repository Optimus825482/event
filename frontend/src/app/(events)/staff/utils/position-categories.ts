/**
 * Pozisyon Kategorileri - Staff Modülü
 * Personel pozisyonlarını kategorilere ayırır
 */

export interface PositionCategory {
  label: string;
  color: string;
  positions: string[];
}

export const POSITION_CATEGORIES: Record<string, PositionCategory> = {
  management: {
    label: "Yönetim (Captain/Supervisor)",
    color: "#f59e0b", // amber
    positions: [
      "Bar / Restaurant Captain",
      "Bar / Restaurant Supervisor",
      "Junior Captain",
      "Captain",
      "Supervisor",
      "F&B Manager",
      "Asst. F&B Manager",
      "F&B Coordinator",
      "Maitre D'",
      "Assistant Maitre D'",
    ],
  },
  waiter: {
    label: "Servis (Waiter/Waitress)",
    color: "#3b82f6", // blue
    positions: [
      "Waiter / Waitress",
      "A'la Carte Waiter / Waitress",
      "Head Waiter / Waitress",
      "Senior Waiter / Waitress",
      "Pool Waiter / Waitress",
      "Room Service Waiter / Waitress",
      "Butler",
    ],
  },
  bar: {
    label: "Bar",
    color: "#8b5cf6", // purple
    positions: [
      "Barman / Barmaid",
      "Bar Girl / Bar Boy",
      "Barista",
      "Host / Hostess",
      "Head Barman / Barmaid",
      "Senior Barman / Barmaid",
      "Sommelier",
    ],
  },
  commis: {
    label: "Commis",
    color: "#10b981", // emerald
    positions: [
      "Bar Commis",
      "Restaurant Commis",
      "Stajyer Bar Commis",
      "Stajyer Restaurant Commis",
      "Commis",
      "Junior Commis",
      "Debarasör",
      "Runner",
    ],
  },
};

// Kategori sırası
export const CATEGORY_ORDER = [
  "management",
  "waiter",
  "bar",
  "commis",
  "other",
];

/**
 * Pozisyonun kategorisini bulur - EXACT MATCH öncelikli
 */
export function getPositionCategory(position: string): string {
  const posLower = position.toLowerCase().trim();

  // Önce tam eşleşme ara
  for (const [catKey, cat] of Object.entries(POSITION_CATEGORIES)) {
    if (cat.positions.some((p) => p.toLowerCase() === posLower)) {
      return catKey;
    }
  }

  // Tam eşleşme yoksa, anahtar kelime bazlı eşleştir (sıra önemli!)
  // Commis önce kontrol edilmeli (Bar Commis, Bar kategorisine düşmesin)
  if (
    posLower.includes("commis") ||
    posLower.includes("stajyer") ||
    posLower.includes("debaras") ||
    posLower.includes("runner")
  ) {
    return "commis";
  }

  // Waiter/Waitress kontrolü
  if (
    posLower.includes("waiter") ||
    posLower.includes("waitress") ||
    posLower.includes("butler")
  ) {
    return "waiter";
  }

  // Bar kontrolü (Barman, Barmaid, Barista, Bar Girl/Boy)
  if (
    posLower.includes("barman") ||
    posLower.includes("barmaid") ||
    posLower.includes("barista") ||
    posLower.includes("bar girl") ||
    posLower.includes("bar boy") ||
    posLower.includes("sommelier") ||
    posLower.includes("host")
  ) {
    return "bar";
  }

  // Yönetim kontrolü (Captain, Supervisor, Manager, Maitre)
  if (
    posLower.includes("captain") ||
    posLower.includes("supervisor") ||
    posLower.includes("manager") ||
    posLower.includes("maitre") ||
    posLower.includes("coordinator")
  ) {
    return "management";
  }

  return "other";
}

/**
 * Kategori bilgisini döndürür
 */
export function getCategoryInfo(category: string): PositionCategory {
  return (
    POSITION_CATEGORIES[category] || {
      label: "Diğer",
      color: "#64748b",
      positions: [],
    }
  );
}
