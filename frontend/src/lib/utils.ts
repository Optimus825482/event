import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Benzersiz ID oluştur
export function generateId(prefix: string = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 9)}`;
}

// Telefon numarası formatla
export function formatPhone(phone: string): string {
  if (!phone) return "";
  // Sadece rakamları al
  const digits = phone.replace(/\D/g, "");
  // Türkiye formatı: 0555 123 4567
  if (digits.length === 10) {
    return `0${digits.substring(0, 3)} ${digits.substring(
      3,
      6
    )} ${digits.substring(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return `${digits.substring(0, 4)} ${digits.substring(
      4,
      7
    )} ${digits.substring(7)}`;
  }
  return phone;
}

// Tarih formatla
export function formatDate(
  date: string | Date,
  format: string = "short"
): string {
  if (!date) return "";
  const d = new Date(date);

  if (format === "short") {
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  if (format === "long") {
    return d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  if (format === "datetime") {
    return d.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return d.toLocaleDateString("tr-TR");
}

// Grid'e snap et
export function snapToGrid(value: number, gridSize: number = 10): number {
  return Math.round(value / gridSize) * gridSize;
}

// Arka plan rengine göre kontrast metin rengi
export function getContrastColor(hexColor: string): string {
  if (!hexColor) return "#ffffff";

  // # işaretini kaldır
  const hex = hexColor.replace("#", "");

  // RGB değerlerini al
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Parlaklık hesapla (YIQ formülü)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // Parlak arka plan için koyu metin, koyu arka plan için açık metin
  return brightness > 128 ? "#000000" : "#ffffff";
}
