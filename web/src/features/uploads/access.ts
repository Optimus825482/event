import { can, type PolicyActor } from "@/features/auth/policy";
import { isAdmin } from "@/features/auth/scope";

export type UploadAccess = "allowed" | "forbidden" | "not_found";

/**
 * Yükleme kategorisi = yolun ilk parçası (`saveImage` çıktısı: `<tür>/<uuid>.webp`); eski yollar da
 * aynı biçimdedir. Davetiye görselleri herkese açık sayfada `/i/<belirteç>/image` üzerinden sunulur,
 * buradan değil.
 *
 * - `logo`: ayarlar ya da davetiye görüntüleyebilen roller (logo davetiye önizlemesinde de görünür).
 * - `invitation`: `invitations:view`.
 * - `event`, `artist`: `events:view`.
 * - `avatar` ve bilinmeyen kategoriler: yalnızca yönetici.
 */
export function checkUploadAccess(actor: PolicyActor, segments: readonly string[]): UploadAccess {
  if (segments.length !== 2) return "not_found";
  const [category] = segments;

  if (category === "logo") {
    return can(actor, "settings", "view") || can(actor, "invitations", "view") ? "allowed" : "forbidden";
  }
  if (category === "invitation") {
    return can(actor, "invitations", "view") ? "allowed" : "forbidden";
  }
  if (category === "event" || category === "artist") {
    return can(actor, "events", "view") ? "allowed" : "forbidden";
  }
  return isAdmin(actor) ? "allowed" : "not_found";
}
