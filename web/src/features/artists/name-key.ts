/** Sanatçı ad anahtarı: kırpılır, ardışık boşluklar teke iner, Türkçe kurallarıyla büyük harfe çevrilir. */
export function artistNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleUpperCase("tr");
}
