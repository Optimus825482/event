import { Injectable } from "@nestjs/common";
import { Staff } from "../../entities/staff.entity";

@Injectable()
export class StaffMatcherService {
  /**
   * Personel adını normalize et (Türkçe karakter dönüşümü + lowercase)
   */
  normalizeStaffName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c");
  }

  /**
   * Personeli eşleştir (tam + kısmi benzerlik)
   */
  matchStaff(
    searchName: string,
    staffNameMap: Map<string, Staff>,
    allStaff: Staff[],
  ): { staff: Staff | null; confidence: number; warnings?: string[] } {
    const normalizedSearch = this.normalizeStaffName(searchName);
    const warnings: string[] = [];

    // Tam eşleşme
    const exactMatch = staffNameMap.get(normalizedSearch);
    if (exactMatch) {
      return { staff: exactMatch, confidence: 100 };
    }

    // Kısmi eşleşme (isim veya soyisim)
    let bestMatch: Staff | null = null;
    let bestScore = 0;

    for (const staff of allStaff) {
      const normalizedStaff = this.normalizeStaffName(staff.fullName);
      const score = this.calculateSimilarity(normalizedSearch, normalizedStaff);

      if (score > bestScore && score >= 60) {
        bestScore = score;
        bestMatch = staff;
      }
    }

    if (bestMatch) {
      if (bestScore < 90) {
        warnings.push(
          `"${searchName}" → "${bestMatch.fullName}" olarak eşleştirildi (%${bestScore})`,
        );
      }
      return { staff: bestMatch, confidence: bestScore, warnings };
    }

    warnings.push(`"${searchName}" için eşleşme bulunamadı`);
    return { staff: null, confidence: 0, warnings };
  }

  /**
   * İki string arasındaki benzerliği hesapla (kelime bazlı)
   */
  calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(" ").filter((w) => w.length > 1);
    const words2 = str2.split(" ").filter((w) => w.length > 1);

    let matchedWords = 0;
    for (const w1 of words1) {
      for (const w2 of words2) {
        if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) {
          matchedWords++;
          break;
        }
      }
    }

    const maxWords = Math.max(words1.length, words2.length);
    if (maxWords === 0) return 0;

    return Math.round((matchedWords / maxWords) * 100);
  }

  /**
   * Değer bir personel ismi gibi görünüyor mu?
   */
  looksLikeStaffName(value: string): boolean {
    if (!value || value.length < 2) return false;

    // Sayı içeriyorsa isim değil
    if (/\d/.test(value)) return false;

    // Bilinen başlıkları hariç tut
    const excludeWords = [
      "PERSONEL",
      "POZİSYON",
      "POSTA",
      "SAAT",
      "MASA",
      "LOCA",
      "BAR",
      "DEPO",
      "EXTRA",
      "DESTEK",
      "EKİBİ",
      "CAPTAIN",
      "SPVR",
      "INCHARGE",
      "ASST",
      "MNG",
      "FB",
    ];

    const upperValue = value.toUpperCase();
    for (const word of excludeWords) {
      if (
        upperValue === word ||
        upperValue.includes(word + " ") ||
        upperValue.includes(" " + word)
      ) {
        return false;
      }
    }

    // En az bir harf içermeli
    return /[A-ZÇĞİÖŞÜa-zçğıöşü]/.test(value);
  }

  /**
   * Hücre değerini temizle
   */
  cleanCellValue(value: any): string {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  /**
   * Masa numaralarını parse et
   */
  parseTableIds(raw: string): string[] {
    if (!raw) return [];

    // "11-12-21-22-23" veya "116-117-132-133" formatını parse et
    const ids = raw
      .split(/[-–,\s]+/)
      .map((id) => id.trim())
      .filter((id) => id && /^\d+$/.test(id));

    return ids;
  }

  /**
   * Vardiya saatlerini parse et
   * "19:00-K" = 19:00-06:00 (K = Kapanış)
   * "17:00-04:00" = normal format
   */
  parseShift(raw: string): { shiftStart: string; shiftEnd: string } {
    if (!raw) return { shiftStart: "18:00", shiftEnd: "06:00" };

    const cleanRaw = raw.replace(/\s+/g, "").replace(/--/g, "-").toUpperCase();

    // K = Kapanış (06:00 olarak varsay)
    if (cleanRaw.includes("-K") || cleanRaw.endsWith("K")) {
      const startMatch = cleanRaw.match(/(\d{1,2}:\d{2})/);
      return {
        shiftStart: startMatch ? this.normalizeTime(startMatch[1]) : "18:00",
        shiftEnd: "06:00",
      };
    }

    // Normal format: "19:00-00:00"
    const timeMatch = cleanRaw.match(/(\d{1,2}:\d{2})[^\d]*(\d{1,2}:\d{2})/);
    if (timeMatch) {
      return {
        shiftStart: this.normalizeTime(timeMatch[1]),
        shiftEnd: this.normalizeTime(timeMatch[2]),
      };
    }

    // Sadece başlangıç saati varsa
    const singleMatch = cleanRaw.match(/(\d{1,2}:\d{2})/);
    if (singleMatch) {
      return {
        shiftStart: this.normalizeTime(singleMatch[1]),
        shiftEnd: "06:00",
      };
    }

    return { shiftStart: "18:00", shiftEnd: "06:00" };
  }

  /**
   * Saat formatını normalize et (9:00 -> 09:00)
   */
  normalizeTime(time: string): string {
    const parts = time.split(":");
    if (parts.length !== 2) return time;

    const hours = parts[0].padStart(2, "0");
    const minutes = parts[1].padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  /**
   * Staff name map oluştur (normalized name -> Staff)
   */
  buildStaffNameMap(allStaff: Staff[]): Map<string, Staff> {
    const map = new Map<string, Staff>();
    allStaff.forEach((staff) => {
      const normalizedName = this.normalizeStaffName(staff.fullName);
      map.set(normalizedName, staff);
    });
    return map;
  }
}
