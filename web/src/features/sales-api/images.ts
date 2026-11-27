import { readFile } from "node:fs/promises";
import type { Db } from "@/db/client";
import { db } from "@/db/client";
import { UPLOAD_ROOT } from "@/features/uploads/root";
import { mediaResponse, uploadContentType } from "@/features/uploads/range";
import { resolveUploadPath } from "@/features/uploads/serve";
import { env } from "@/env";
import { checkSalesAuth } from "./auth";
import { isListedImagePath } from "./catalog";
import { HERO_VIDEO_PATH_PATTERN, IMAGE_PATH_PATTERN } from "./contract";
import { salesFailure, toSalesResponse } from "./http";

export type SalesImageDeps = { db: Db; secret: string | undefined; root: string };

/**
 * Satış sitesinin çekirdekten etkinlik/sanatçı görsellerini (ve hero WebM videosunu) çektiği uç işleyicisi.
 * `Range` isteği desteklenir (tarayıcıda video oynatma).
 */
export function createSalesImageHandler(
  deps: SalesImageDeps,
): (request: Request, kind: string, file: string) => Promise<Response> {
  return async (request, kind, file) => {
    const auth = checkSalesAuth(request.headers, deps.secret);
    if (!auth.ok) return salesFailure(auth.code);

    const rel = `${kind}/${file}`;
    const video = HERO_VIDEO_PATH_PATTERN.test(rel);
    if (!video && !IMAGE_PATH_PATTERN.test(rel)) return salesFailure("event_not_found");

    try {
      const listed = await isListedImagePath(deps.db, rel, video ? "hero" : "any");
      if (!listed) return salesFailure("event_not_found");

      const resolved = resolveUploadPath(deps.root, [kind, file]);
      if (!resolved) return salesFailure("event_not_found");

      let data: Buffer;
      try {
        data = await readFile(/* turbopackIgnore: true */ resolved);
      } catch {
        return salesFailure("event_not_found");
      }

      return mediaResponse(data, {
        contentType: uploadContentType(rel),
        cacheControl: "private, max-age=300",
        range: request.headers.get("range"),
      });
    } catch (error) {
      return toSalesResponse(error);
    }
  };
}

export const salesImageHandler = createSalesImageHandler({
  db,
  secret: env.SALES_API_SECRET,
  root: UPLOAD_ROOT,
});
