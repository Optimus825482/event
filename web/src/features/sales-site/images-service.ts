import { eq, or } from "drizzle-orm";
import type { Db } from "@/db/client";
import { artists, eventSiteContent, events } from "@/db/schema";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { getEventOrThrow } from "@/features/events/service";
import {
  deleteImage,
  IMAGE_REJECTED_MESSAGE,
  ImageRejectedError,
  saveImage,
  type ImageKind,
} from "@/features/uploads/images";
import { UPLOAD_ROOT } from "@/features/uploads/root";
import { isWebm, saveVideo, VideoRejectedError } from "@/features/uploads/videos";
import { DomainError } from "@/lib/action";
import { validHeroPath, type ImageSlot } from "./image-status";
import type { SiteImageInput } from "./schemas";

async function isImageStillUsed(db: Db, imagePath: string): Promise<boolean> {
  const [ev] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.coverImage, imagePath))
    .limit(1);
  if (ev) return true;

  const [site] = await db
    .select({ id: eventSiteContent.eventId })
    .from(eventSiteContent)
    .where(eq(eventSiteContent.heroImage, imagePath))
    .limit(1);
  if (site) return true;

  const [art] = await db
    .select({ id: artists.id })
    .from(artists)
    .where(or(eq(artists.image, imagePath)))
    .limit(1);
  return art !== undefined;
}

/** Yalnızca hero alanı WebM video kabul eder; diğer alanlarda video görüntü reddiyle geri çevrilir. */
const HERO_REJECTED = "Yalnızca JPG, PNG, WebP görüntüsü veya WebM video yüklenebilir";

async function saveSlotFile(file: File, slot: ImageSlot, root: string): Promise<{ path: string }> {
  if (slot !== "hero") return saveImage(file, slot === "artist" ? "artist" : "event", root);
  // Karar istemcinin bildirdiği türe değil içeriğe göre verilir.
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  if (isWebm(head)) return saveVideo(file, root);
  try {
    return await saveImage(file, "event" satisfies ImageKind, root);
  } catch (error) {
    if (error instanceof ImageRejectedError && error.message === IMAGE_REJECTED_MESSAGE) {
      throw new ImageRejectedError(HERO_REJECTED);
    }
    throw error;
  }
}

async function cleanupOldImage(db: Db, oldPath: string | null, root: string): Promise<void> {
  // Hero dışı sütunlar yalnızca görsel tutar; `validHeroPath` iki biçimi de kapsar.
  const safe = validHeroPath(oldPath);
  if (!safe) return;
  if (await isImageStillUsed(db, safe)) return;
  await deleteImage(safe, root).catch(() => undefined);
}

async function readCurrentImage(
  db: Db,
  eventId: string,
  coverImage: string | null,
  artistId: string | null,
  slot: ImageSlot,
): Promise<{ oldPath: string | null; artistId: string | null }> {
  if (slot === "cover") return { oldPath: coverImage, artistId };
  if (slot === "hero") {
    const [row] = await db
      .select({ heroImage: eventSiteContent.heroImage })
      .from(eventSiteContent)
      .where(eq(eventSiteContent.eventId, eventId));
    return { oldPath: row?.heroImage ?? null, artistId };
  }
  if (!artistId) {
    throw new DomainError("conflict", "Etkinlik bir sanatçı kaydına bağlı değil");
  }
  const [artist] = await db
    .select({ image: artists.image })
    .from(artists)
    .where(eq(artists.id, artistId));
  return { oldPath: artist?.image ?? null, artistId };
}

/** Kapak, hero (görsel ya da WebM video) veya sanatçı görselini yükler; DB hatasında yeni dosyayı geri alır, paylaşılmayan eskiyi siler. */
export async function replaceSiteImage(
  db: Db,
  actor: Actor,
  input: SiteImageInput,
  file: File,
  root: string = UPLOAD_ROOT,
): Promise<{ slot: ImageSlot; path: string }> {
  authorize(actor, "events", "edit");
  const event = await getEventOrThrow(db, input.eventId);
  const { oldPath, artistId } = await readCurrentImage(db, event.id, event.coverImage, event.artistId, input.slot);

  let savedPath: string;
  try {
    const saved = await saveSlotFile(file, input.slot, root);
    savedPath = saved.path;
  } catch (error) {
    if (error instanceof ImageRejectedError || error instanceof VideoRejectedError) {
      throw new DomainError("invalid", error.message);
    }
    throw error;
  }

  try {
    if (input.slot === "cover") {
      await db.update(events).set({ coverImage: savedPath }).where(eq(events.id, event.id));
    } else if (input.slot === "hero") {
      await db
        .insert(eventSiteContent)
        .values({ eventId: event.id, heroImage: savedPath })
        .onConflictDoUpdate({
          target: eventSiteContent.eventId,
          set: { heroImage: savedPath, updatedAt: new Date() },
        });
    } else {
      await db.update(artists).set({ image: savedPath }).where(eq(artists.id, artistId!));
    }
  } catch (error) {
    await deleteImage(savedPath, root).catch(() => undefined);
    throw error;
  }

  if (oldPath && oldPath !== savedPath) {
    await cleanupOldImage(db, oldPath, root);
  }
  return { slot: input.slot, path: savedPath };
}

/** Kapak, hero veya sanatçı görselini kaldırır ve başka yerde kullanılmıyorsa diskten siler. */
export async function removeSiteImage(
  db: Db,
  actor: Actor,
  input: SiteImageInput,
  root: string = UPLOAD_ROOT,
): Promise<{ slot: ImageSlot }> {
  authorize(actor, "events", "edit");
  const event = await getEventOrThrow(db, input.eventId);
  const { oldPath, artistId } = await readCurrentImage(db, event.id, event.coverImage, event.artistId, input.slot);

  if (!oldPath) return { slot: input.slot };

  if (input.slot === "cover") {
    await db.update(events).set({ coverImage: null }).where(eq(events.id, event.id));
  } else if (input.slot === "hero") {
    await db
      .update(eventSiteContent)
      .set({ heroImage: null, updatedAt: new Date() })
      .where(eq(eventSiteContent.eventId, event.id));
  } else {
    await db.update(artists).set({ image: null }).where(eq(artists.id, artistId!));
  }

  await cleanupOldImage(db, oldPath, root);
  return { slot: input.slot };
}
