import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { UPLOAD_ROOT } from "./root";
import { resolveUploadPath } from "./serve";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_KINDS = ["avatar", "event", "invitation", "logo", "artist"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

const MAX_DIMENSION = 2048;
const MAX_INPUT_PIXELS = 50_000_000;

/** Kullanıcıya gösterilebilir (Türkçe, ayrıntısız) görüntü reddi. */
export class ImageRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageRejectedError";
  }
}

const REJECTED = "Yalnızca JPG, PNG veya WebP görüntüleri yüklenebilir";

/** Dosya imzasına (ilk baytlar) bakar; ad ve bildirilen tür dikkate alınmaz. */
function hasImageSignature(b: Buffer): boolean {
  const jpeg = b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
  return jpeg || png || webp;
}

/**
 * Görüntüyü doğrular (imza, ≤5 MB), `sharp` ile yeniden kodlayıp WebP olarak
 * `<kök>/<tür>/<rastgele-uuid>.webp` yoluna yazar. Yeniden kodlama meta verileri ve gömülü içeriği atar.
 * `root` yalnızca testler içindir.
 */
export async function saveImage(
  file: File,
  kind: ImageKind,
  root: string = UPLOAD_ROOT,
): Promise<{ path: string }> {
  if (!IMAGE_KINDS.includes(kind)) throw new ImageRejectedError("Geçersiz görüntü türü");
  if (file.size > MAX_IMAGE_BYTES) throw new ImageRejectedError("Dosya boyutu en fazla 5 MB olabilir");
  const input = Buffer.from(await file.arrayBuffer());
  if (input.length > MAX_IMAGE_BYTES) throw new ImageRejectedError("Dosya boyutu en fazla 5 MB olabilir");
  if (!hasImageSignature(input)) throw new ImageRejectedError(REJECTED);

  let output: Buffer;
  try {
    output = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ImageRejectedError(REJECTED);
  }

  const relative = `${kind}/${randomUUID()}.webp`;
  const target = resolveUploadPath(root, relative.split("/"));
  if (!target) throw new Error("Yükleme yolu çözülemedi");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, output, { flag: "wx" });
  return { path: relative };
}

/** Yüklenmiş görüntüyü siler. Dosya yoksa sessizce geçer; kök dışı yolda hata verir. */
export async function deleteImage(imagePath: string, root: string = UPLOAD_ROOT): Promise<void> {
  const target = resolveUploadPath(root, imagePath.split("/"));
  if (!target) throw new Error("Geçersiz görüntü yolu");
  try {
    await unlink(target);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}
