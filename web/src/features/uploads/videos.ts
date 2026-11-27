import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_ROOT } from "./root";
import { resolveUploadPath } from "./serve";

/** Hero (tanıtım) videosu için en büyük dosya boyutu. */
export const MAX_VIDEO_BYTES = 8 * 1024 * 1024;

/** Kullanıcıya gösterilebilir (Türkçe, ayrıntısız) video reddi. */
export class VideoRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoRejectedError";
  }
}

const EBML_ID = 0x1a45dfa3;
const DOCTYPE_ID = 0x4282;
/** EBML başlığı küçüktür; bundan büyüğü şüphelidir ve WebM sayılmaz. */
const MAX_HEADER_BYTES = 4096;

type Vint = { value: number; length: number };

/** EBML değişken uzunluklu tamsayısını okur. `keepMarker` öğe kimliklerinde işaret bitini korur. */
function readVint(b: Uint8Array, offset: number, keepMarker: boolean): Vint | null {
  const first = b[offset];
  if (first === undefined || first === 0) return null;
  let length = 1;
  while (length <= 8 && (first & (0x80 >> (length - 1))) === 0) length++;
  if (length > 8 || offset + length > b.length) return null;
  let value = keepMarker ? first : first & (0xff >> length);
  for (let i = 1; i < length; i++) value = value * 256 + b[offset + i]!;
  return { value, length };
}

/**
 * İçerik koklama: dosya EBML başlığıyla (`1A 45 DF A3`) başlıyor ve başlıktaki DocType `webm` ise `true`.
 * Dosya adı ve istemcinin bildirdiği MIME türü dikkate alınmaz.
 */
export function isWebm(b: Uint8Array): boolean {
  const id = readVint(b, 0, true);
  if (!id || id.value !== EBML_ID) return false;
  const size = readVint(b, id.length, false);
  if (!size) return false;
  const start = id.length + size.length;
  const end = start + size.value;
  if (size.value > MAX_HEADER_BYTES || end > b.length) return false;

  let offset = start;
  while (offset < end) {
    const childId = readVint(b, offset, true);
    if (!childId) return false;
    const childSize = readVint(b, offset + childId.length, false);
    if (!childSize) return false;
    const dataStart = offset + childId.length + childSize.length;
    const dataEnd = dataStart + childSize.value;
    if (dataEnd > end) return false;
    if (childId.value === DOCTYPE_ID) {
      return Buffer.from(b.subarray(dataStart, dataEnd)).toString("latin1").replace(/\0+$/, "") === "webm";
    }
    offset = dataEnd;
  }
  return false;
}

const TOO_LARGE = `Video boyutu en fazla ${MAX_VIDEO_BYTES / (1024 * 1024)} MB olabilir`;

/**
 * WebM videoyu doğrular (içerik imzası + DocType, ≤ `MAX_VIDEO_BYTES`) ve olduğu gibi
 * `<kök>/event/<rastgele-uuid>.webm` yoluna yazar. Yeniden kodlanmaz; yalnızca hero alanı kullanır.
 * `root` yalnızca testler içindir.
 */
export async function saveVideo(file: File, root: string = UPLOAD_ROOT): Promise<{ path: string }> {
  if (file.size > MAX_VIDEO_BYTES) throw new VideoRejectedError(TOO_LARGE);
  const input = new Uint8Array(await file.arrayBuffer());
  if (input.length > MAX_VIDEO_BYTES) throw new VideoRejectedError(TOO_LARGE);
  if (!isWebm(input)) throw new VideoRejectedError("Yalnızca WebM videolar yüklenebilir");

  const relative = `event/${randomUUID()}.webm`;
  const target = resolveUploadPath(root, relative.split("/"));
  if (!target) throw new Error("Yükleme yolu çözülemedi");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, input, { flag: "wx" });
  return { path: relative };
}
