import { IMAGE_PATH_PATTERN } from "@/lib/core/contract";

export const IMAGE_ROUTE_PREFIX = "/api/gorsel";

/** Yükleme yolunu (`<tür>/<uuid>.webp`) kendi kökenimizdeki görsel rotasına çevirir. */
export function imageUrl(path: string | null | undefined): string | null {
  if (typeof path !== "string" || !IMAGE_PATH_PATTERN.test(path)) return null;
  return `${IMAGE_ROUTE_PREFIX}/${path}`;
}
