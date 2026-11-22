export const CAMERA_FALLBACK_HINT = "QR kodu aşağıdaki kutuya yazarak ya da manuel aramayla giriş yapabilirsiniz.";

function nameOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (typeof error === "object" && error !== null && "name" in error && typeof error.name === "string") {
    return error.name;
  }
  return "";
}

/** Kamera açılırken oluşan hatayı operatöre Türkçe, eyleme dönük bir mesaja çevirir. */
export function describeCameraError(error: unknown): string {
  const text = nameOf(error);
  if (/NotAllowed|PermissionDenied|Permission denied/i.test(text)) {
    return `Kamera izni reddedildi. Tarayıcı ayarlarından kamera iznini açın. ${CAMERA_FALLBACK_HINT}`;
  }
  if (/NotFound|DevicesNotFound|Requested device not found/i.test(text)) {
    return `Kamera bulunamadı. ${CAMERA_FALLBACK_HINT}`;
  }
  if (/NotReadable|TrackStart|in use/i.test(text)) {
    return `Kamera başka bir uygulama tarafından kullanılıyor. ${CAMERA_FALLBACK_HINT}`;
  }
  if (/Secure|insecure|mediaDevices/i.test(text)) {
    return `Kamera yalnızca güvenli bağlantıda (HTTPS) çalışır. ${CAMERA_FALLBACK_HINT}`;
  }
  return `Kamera başlatılamadı. ${CAMERA_FALLBACK_HINT}`;
}
