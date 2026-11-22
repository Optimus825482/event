import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { systemSettings } from "@/db/schema";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { deleteImage, saveImage } from "@/features/uploads/images";
import { UPLOAD_ROOT } from "@/features/uploads/root";
import { getSettings, type PublicSettings } from "./service";

/**
 * Firma logosunu değiştirir: yeni görüntü kaydedilir, ayar satırı güncellenir, eski dosya silinir.
 * Veritabanı yazımı başarısız olursa yeni dosya geri alınır. `root` yalnızca testler içindir.
 */
export async function replaceLogo(
  db: Db | Tx,
  actor: Actor,
  file: File,
  root: string = UPLOAD_ROOT,
): Promise<PublicSettings> {
  authorize(actor, "settings", "edit");
  const current = await getSettings(db, actor);
  const { path } = await saveImage(file, "logo", root);
  try {
    await db.update(systemSettings).set({ logo: path }).where(eq(systemSettings.id, current.id));
  } catch (error) {
    await deleteImage(path, root);
    throw error;
  }
  if (current.logo) await deleteImage(current.logo, root).catch(() => undefined);
  return { ...current, logo: path };
}
