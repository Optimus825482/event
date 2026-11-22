import { env, qrSigningKey } from "@/env";
import { signQrToken } from "@/features/reservations/qr-token";

/**
 * Taşınan her rezervasyon için uygulamanın kendi giriş QR belirteci üretilir; algoritma ve anahtar
 * reservations modülünden gelir (`signQrToken`, `qrSigningKey`): `QR_SIGNING_KEY` tanımlıysa o,
 * değilse `BETTER_AUTH_SECRET`'tan HKDF-SHA256 ("qr-token-v1"). Bu yüzden betik, uygulamanın
 * çalışacağı ortamın AYNI anahtarlarıyla çalıştırılmalıdır; aksi halde basılı QR'lar doğrulanmaz.
 * Eski `qrCodeHash` değerleri ayrıca `legacy_qr_hash` sütununda tutulur.
 */
export function qrTokenFactory(key: Buffer = qrSigningKey(env)): (reservationId: string) => string {
  return (reservationId) => signQrToken(reservationId, key);
}
