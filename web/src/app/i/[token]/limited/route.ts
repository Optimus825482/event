import { parseRetryAfter, tooManyRequestsResponse } from "@/features/invitations/rate-limit";

/**
 * Sayfa bileşenleri HTTP durum kodunu belirleyemez; hız sınırına takılan davetiye sayfası buraya
 * yönlendirilir ve gerçek bir 429 + `Retry-After` yanıtı alır. Durumsuzdur, veritabanına dokunmaz.
 */
export function GET(request: Request): Response {
  return tooManyRequestsResponse(parseRetryAfter(new URL(request.url).searchParams.get("r")));
}
