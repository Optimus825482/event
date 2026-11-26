/** Sanatçı ad anahtarı: NFC, görünmez karakterler atılır, boşluklar teke iner, Türkçe kurallarıyla büyük harfe çevrilir. */
export function artistNameKey(name: string): string {
  return name
    .normalize("NFC")
    .replace(/[​-‍﻿]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("tr");
}
