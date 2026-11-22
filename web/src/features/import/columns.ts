import type { HeaderRequirements } from "./headers";

export type ReservationColumn = "tableLabel" | "guestName" | "guestPhone" | "guestEmail" | "guestCount" | "note";

/** Rezervasyon dosyası başlıkları. İlk etiket şablonda kullanılır; diğerleri takma addır. */
export const RESERVATION_COLUMNS: HeaderRequirements<ReservationColumn> = {
  specs: [
    {
      key: "tableLabel",
      label: "Masa etiketi",
      required: true,
      aliases: ["masa", "masa no", "masa numarası", "masa adı", "table", "table label", "table no"],
    },
    {
      key: "guestName",
      label: "Misafir adı",
      required: true,
      aliases: ["misafir", "ad soyad", "adı soyadı", "isim", "müşteri adı", "müşteri", "guest name", "guest", "name", "full name"],
    },
    {
      key: "guestPhone",
      label: "Telefon",
      aliases: ["telefon no", "telefon numarası", "tel", "cep", "cep telefonu", "gsm", "phone", "mobile"],
    },
    { key: "guestEmail", label: "E-posta", aliases: ["eposta", "e-mail", "email", "mail", "e posta"] },
    {
      key: "guestCount",
      label: "Kişi sayısı",
      required: true,
      aliases: ["kişi", "adet", "misafir sayısı", "guest count", "guests", "pax", "party size"],
    },
    { key: "note", label: "Not", aliases: ["notlar", "özel istek", "açıklama", "note", "notes", "special requests"] },
  ],
};

export type AssignmentColumn = "sicilNo" | "staffName" | "tables" | "group" | "shift" | "role";

/** Atama dosyası başlıkları: sicil no VEYA personel adı; masa etiketleri VEYA grup zorunludur. */
export const ASSIGNMENT_COLUMNS: HeaderRequirements<AssignmentColumn> = {
  specs: [
    {
      key: "sicilNo",
      label: "Sicil no",
      aliases: ["sicil", "sicil numarası", "sicil_no", "personel no", "employee id", "staff id"],
    },
    {
      key: "staffName",
      label: "Personel adı",
      aliases: ["personel", "ad soyad", "adı soyadı", "isim", "staff name", "staff", "name", "full name"],
    },
    {
      key: "tables",
      label: "Masa etiketleri",
      aliases: ["masa etiketi", "masalar", "masa", "tables", "table", "table labels"],
    },
    { key: "group", label: "Grup", aliases: ["masa grubu", "grup adı", "group", "table group"] },
    { key: "shift", label: "Vardiya", aliases: ["shift", "vardiya adı"] },
    { key: "role", label: "Görev", aliases: ["rol", "role", "duty", "task", "görevi"] },
  ],
  anyOf: [
    ["sicilNo", "staffName"],
    ["tables", "group"],
  ],
};
