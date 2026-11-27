import { createHash } from "node:crypto";

/** UTF-8 metnin SHA-256 özeti (ham bayt). Sabit zamanlı karşılaştırmalarda uzunluğu eşitlemek için kullanılır. */
export function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** UTF-8 metnin SHA-256 özeti, onaltılık metin olarak (ör. hız sınırı anahtarında ham değeri saklamamak için). */
export function sha256Hex(value: string): string {
  return sha256(value).toString("hex");
}
