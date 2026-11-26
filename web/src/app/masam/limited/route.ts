import { parseRetryAfter, tooManyRequestsResponse } from "@/features/invitations/rate-limit";

/** Sayfalar durum kodu belirleyemez; hız sınırına takılan arama buraya yönlenir ve gerçek 429 alır. */
export function GET(request: Request): Response {
  return tooManyRequestsResponse(parseRetryAfter(new URL(request.url).searchParams.get("r")));
}
