import { createHash } from "node:crypto";
import type { Availability } from "@/lib/core/contract";

export const DURUM_CACHE_CONTROL = "private, no-cache";

/** ETag yalnızca masa durumunun özetidir; `at` katılmaz (zaman damgası değişse de içerik aynıdır). */
export function availabilityEtag(a: Availability): string {
  const digest = createHash("sha256").update(JSON.stringify(a.tables)).digest("base64url").slice(0, 22);
  return `"${digest}"`;
}

const matchesEtag = (ifNoneMatch: string | null, etag: string): boolean =>
  ifNoneMatch !== null &&
  ifNoneMatch
    .split(",")
    .map((part) => part.trim().replace(/^W\//, ""))
    .some((part) => part === etag || part === "*");

export function durumResponse(a: Availability | null, ifNoneMatch: string | null): Response {
  if (a === null) {
    return Response.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const etag = availabilityEtag(a);
  const headers = { ETag: etag, "Cache-Control": DURUM_CACHE_CONTROL };
  if (matchesEtag(ifNoneMatch, etag)) return new Response(null, { status: 304, headers });
  return Response.json(a, { status: 200, headers });
}

export function unavailableResponse(): Response {
  return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
