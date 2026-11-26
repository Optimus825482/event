const TR_FOLD: Record<string, string> = { İ: "I", Ş: "S", Ğ: "G", Ü: "U", Ö: "O", Ç: "C" };

/**
 * Soyadı/ad karşılaştırma anahtarı: kırp, Türkçe kurallarıyla büyüt, Türkçe harfleri ASCII karşılığına indir,
 * harf olmayan her şeyi (boşluk, tire, kesme, rakam) at. "ışık", "ISIK" ve "Isık" aynı anahtarı verir.
 */
export function nameKey(input: string): string {
  const upper = input.trim().normalize("NFC").toLocaleUpperCase("tr");
  let out = "";
  for (const ch of upper) {
    const folded = TR_FOLD[ch] ?? ch;
    if (/^\p{L}$/u.test(folded)) out += folded;
  }
  return out;
}

/** Boşlukla ayrılmış son sözcüğün anahtarı; boş girdi `""`. */
export function lastNameKeyOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter((w) => w.length > 0);
  const last = words[words.length - 1];
  return last === undefined ? "" : nameKey(last);
}
