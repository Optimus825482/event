// Arşiv gösterim biçimleri (saf). Para dizgeden biçimlenir; `Number`/`parseFloat` kullanılmaz.

export const DEMO_NOTICE = "DEMO - gerçek ödeme alınmadı";

const AMOUNT_PATTERN = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/** "1234567.8", "TRY" → "1.234.567,80 TRY": binlik nokta, ondalık virgül, sonda para birimi kodu. */
export function formatMoney(amount: string, currency: string): string {
  const match = AMOUNT_PATTERN.exec(amount);
  if (!match) return `${amount} ${currency}`;
  const [, sign = "", whole = "0", fraction = ""] = match;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${grouped},${fraction.padEnd(2, "0")} ${currency}`;
}

/** 42.9 → "%42,9"; tam sayıda ondalıksız ("%50"); veri yoksa "—". */
export function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `%${String(rate).replace(".", ",")}`;
}

/** İşaretli tutar eksi ile mi başlıyor (negatif net görsel ayrımı için). */
export function isNegativeAmount(amount: string): boolean {
  return amount.startsWith("-") && /[1-9]/.test(amount);
}
