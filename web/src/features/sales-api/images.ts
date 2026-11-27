import { readFile } from "node:fs/promises";
import type { Db } from "@/db/client";
import { db } from "@/db/client";
import { UPLOAD_ROOT } from "@/features/uploads/root";
import { resolveUploadPath } from "@/features/uploads/serve";
import { env } from "@/env";
import { checkSalesAuth } from "./auth";
import { isListedImagePath } from "./catalog";
import { IMAGE_PATH_PATTERN } from "./contract";
import { salesFailure, toSalesResponse } from "./http";

export type SalesImageDeps = { db: Db; secret: string | undefined; root: string };

/** Satış sitesinin çekirdekten etkinlik/sanatçı görsellerini çektiği uç işleyicisi. */
export function createSalesImageHandler(
  deps: SalesImageDeps,
): (request: Request, kind: string, file: string) => Promise<Response> {
  return async (request, kind, file) => {
    const auth = checkSalesAuth(request.headers, deps.secret);
    if (!auth.ok) return salesFailure(auth.code);

    const rel = `${kind}/${file}`;
    if (!IMAGE_PATH_PATTERN.test(rel)) return salesFailure("event_not_found");

    try {
      const listed = await isListedImagePath(deps.db, rel);
      if (!listed) return salesFailure("event_not_found");

      const resolved = resolveUploadPath(deps.root, [kind, file]);
      if (!resolved) return salesFailure("event_not_found");

      let data: Buffer;
      try {
        data = await readFile(/* turbopackIgnore: true */ resolved);
      } catch {
        return salesFailure("event_not_found");
      }

      return new Response(new Uint8Array(data), {
        status: 200,
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "private, max-age=300",
          "X-Content-Type-Options": "nosniff",
          "Content-Length": String(data.length),
        },
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
