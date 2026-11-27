import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { isWebm, MAX_VIDEO_BYTES, VideoRejectedError } from "./videos";

/**
 * VP9 sabit kalite değeri (`-crf N -b:v 0`). Google'ın VP9 VOD önerisi 1080p için 31, 720p için 32'dir;
 * çıktı en fazla 1280 px'e (hero kutusu ekranda ~600 px) ölçeklenir; 720p önerisinden (32) bir kademe yüksek kalite seçildi: hareketli, üstü metinle örtülen sessiz
 * hero arka planında gözle ayırt edilemeyen kalite verir, H.264 girdilere göre genelde birkaç kat küçük dosya üretir.
 * Daha düşük değer (30) dosyayı belirgin büyütüp 15 MB sınırını zorlar; 33 ve üstü degrade ve karanlık
 * sahnelerde bantlaşma göstermeye başlar.
 */
export const VIDEO_CRF = 31;
/** Sıkıştırma öncesi kabul edilen en büyük yükleme. Çıktı ayrıca `MAX_VIDEO_BYTES` (15 MB) ile sınırlıdır. */
export const MAX_VIDEO_INPUT_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 60;
export const MAX_VIDEO_EDGE = 1280;
export const MAX_VIDEO_FPS = 30;
export const FFMPEG_TIMEOUT_MS = 120_000;
const FFPROBE_TIMEOUT_MS = 30_000;

export type VideoContainer = "webm" | "mp4" | "mov";

const MP4_BRANDS = new Set([
  "isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "M4VH", "M4VP", "dash", "MSNV", "f4v ",
]);
const MOV_BRANDS = new Set(["qt  "]);

function brandKind(brand: string): VideoContainer | null {
  if (MP4_BRANDS.has(brand)) return "mp4";
  if (MOV_BRANDS.has(brand)) return "mov";
  return null;
}

/**
 * İçerik koklama: WebM (EBML + DocType) ya da ilk kutusu `ftyp` olan ISO BMFF (MP4/MOV).
 * Önce ana marka, tanınmazsa uyumlu markalar denenir. HEIC/AVIF gibi görsel markaları video sayılmaz.
 */
export function sniffVideo(b: Uint8Array): VideoContainer | null {
  if (isWebm(b)) return "webm";
  if (b.length < 16) return null;
  const buf = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
  if (buf.toString("latin1", 4, 8) !== "ftyp") return null;
  const boxSize = buf.readUInt32BE(0);
  if (boxSize < 16 || boxSize > 4096) return null;
  const end = Math.min(boxSize, buf.length);
  const major = brandKind(buf.toString("latin1", 8, 12));
  if (major) return major;
  for (let offset = 16; offset + 4 <= end; offset += 4) {
    const kind = brandKind(buf.toString("latin1", offset, offset + 4));
    if (kind) return kind;
  }
  return null;
}

/**
 * Girdi güvenliği: demuxer içerik koklamasıyla bulunan türe sabitlenir (ffmpeg kendi tahminiyle HLS/concat gibi
 * dış kaynağa başvuran biçimlere geçemez), yalnız `file` protokolüne izin verilir (MP4 `dref` vb. ile ağ/başka
 * dosya okunamaz) ve yol `file:` önekiyle verilir.
 */
function inputArgs(inputPath: string, kind: VideoContainer): string[] {
  return ["-protocol_whitelist", "file", "-f", kind === "webm" ? "matroska" : "mov", "-i", `file:${inputPath}`];
}

/** ffmpeg argümanları (kabuk yok; her öğe ayrı argüman). Saf fonksiyon: testler doğrudan denetler. */
export function buildFfmpegArgs(inputPath: string, outputPath: string, kind: VideoContainer): string[] {
  const scale =
    `scale=w='min(${MAX_VIDEO_EDGE},iw)':h='min(${MAX_VIDEO_EDGE},ih)'` +
    ":force_original_aspect_ratio=decrease:force_divisible_by=2";
  return [
    "-hide_banner", "-nostdin", "-loglevel", "error", "-y",
    ...inputArgs(inputPath, kind),
    // Yalnız ilk görüntü akışı; ses (hero sessiz oynar), altyazı, veri akışı ve tüm metadata atılır.
    "-map", "0:v:0", "-an", "-sn", "-dn",
    "-map_metadata", "-1", "-map_chapters", "-1",
    "-vf", scale,
    "-fpsmax", String(MAX_VIDEO_FPS),
    "-c:v", "libvpx-vp9", "-crf", String(VIDEO_CRF), "-b:v", "0",
    // `good` + `cpu-used 4`: `best`/0'a göre çok daha hızlı, kalite farkı CRF'te gözle seçilmez.
    "-deadline", "good", "-cpu-used", "4", "-row-mt", "1",
    "-pix_fmt", "yuv420p",
    "-f", "webm", outputPath,
  ];
}

export function buildFfprobeArgs(inputPath: string, kind: VideoContainer): string[] {
  return ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", ...inputArgs(inputPath, kind)];
}

type Env = Record<string, string | undefined>;

export function ffmpegPath(env: Env = process.env): string {
  return env.FFMPEG_PATH || "ffmpeg";
}

/** `FFPROBE_PATH`, yoksa `FFMPEG_PATH` ile aynı klasördeki ffprobe, o da yoksa PATH. */
export function ffprobePath(env: Env = process.env): string {
  if (env.FFPROBE_PATH) return env.FFPROBE_PATH;
  if (!env.FFMPEG_PATH) return "ffprobe";
  const p = env.FFMPEG_PATH.includes("\\") && !env.FFMPEG_PATH.includes("/") ? path.win32 : path;
  const ext = /\.exe$/i.test(env.FFMPEG_PATH) ? ".exe" : "";
  return p.join(p.dirname(env.FFMPEG_PATH), `ffprobe${ext}`);
}

export type RunResult = { code: number | null; stdout: string; stderr: string };
/** Süreç başlatılamazsa ya da zaman aşımına uğrarsa reddeder; çıkış kodunu yorumlamaz. */
export type Runner = (cmd: string, args: string[], opts: { timeoutMs: number }) => Promise<RunResult>;

const OUTPUT_CAP = 16 * 1024;
const keepTail = (s: string) => (s.length > OUTPUT_CAP ? s.slice(-OUTPUT_CAP) : s);

export const runProcess: Runner = (cmd, args, { timeoutMs }) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => (stdout = keepTail(stdout + c.toString())));
    child.stderr.on("data", (c: Buffer) => (stderr = keepTail(stderr + c.toString())));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${path.basename(cmd)} ${timeoutMs} ms içinde bitmedi`));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });

/** Süreç içi kuyruk: aynı anda en fazla bir dönüştürme (CPU ve bellek yoğun). */
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

export type CompressDeps = {
  run?: Runner;
  env?: Env;
  timeoutMs?: number;
  log?: { warn: (message: string) => void };
};

/** ffmpeg/ffprobe başlatılamadı ya da başarısız oldu (girdi reddi değil). */
class ToolFailure extends Error {}

const TOO_LONG = `Video en fazla ${MAX_VIDEO_DURATION_SECONDS} saniye olabilir`;
const STILL_TOO_LARGE = "Video sıkıştırıldıktan sonra da 15 MB'ı aşıyor; daha kısa bir video yükleyin.";

async function runTool(run: Runner, cmd: string, args: string[], timeoutMs: number): Promise<string> {
  let result: RunResult;
  try {
    result = await run(cmd, args, { timeoutMs });
  } catch (error) {
    throw new ToolFailure(`${path.basename(cmd)} çalıştırılamadı: ${(error as Error).message}`);
  }
  if (result.code !== 0) {
    throw new ToolFailure(`${path.basename(cmd)} ${result.code} koduyla bitti: ${result.stderr.trim().slice(-500)}`);
  }
  return result.stdout;
}

/**
 * Hero videosunu VP9 WebM'e sıkıştırır (bkz. `buildFfmpegArgs`). Girdi WebM, MP4 ya da MOV olabilir (≤ 50 MB, ≤ 60 sn).
 * - WebM girdide çıktı orijinalden küçük değilse, ya da ffmpeg yok/başarısızsa orijinal döner (uyarı günlüğe yazılır).
 * - MP4/MOV her zaman WebM'e dönüştürülür; ffmpeg yok/başarısızsa "Video dönüştürülemedi".
 * - Sıkıştırılmış çıktı `MAX_VIDEO_BYTES`'ı aşarsa reddedilir.
 * Kullanıcıya gösterilecek retler `VideoRejectedError`'dır. Dönen baytlar yine `saveVideo` ile doğrulanıp yazılmalıdır.
 */
export async function compressHeroVideo(file: File | Uint8Array, deps: CompressDeps = {}): Promise<Uint8Array> {
  const size = file instanceof Uint8Array ? file.byteLength : file.size;
  const tooLarge = new VideoRejectedError(`Video boyutu en fazla ${MAX_VIDEO_INPUT_BYTES / (1024 * 1024)} MB olabilir`);
  if (size > MAX_VIDEO_INPUT_BYTES) throw tooLarge;
  const input = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());
  if (input.byteLength > MAX_VIDEO_INPUT_BYTES) throw tooLarge;
  const kind = sniffVideo(input);
  if (!kind) throw new VideoRejectedError("Yalnızca WebM, MP4 veya MOV videolar yüklenebilir");

  const run = deps.run ?? runProcess;
  const env = deps.env ?? process.env;
  const log = deps.log ?? console;

  return exclusive(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "hero-video-"));
    try {
      const inputPath = path.join(dir, "girdi");
      const outputPath = path.join(dir, "cikti.webm");
      await writeFile(inputPath, input);

      let output: Uint8Array;
      try {
        const probed = await runTool(run, ffprobePath(env), buildFfprobeArgs(inputPath, kind), FFPROBE_TIMEOUT_MS);
        const duration = Number.parseFloat(probed.trim());
        // Süresi başlıkta yazmayan (ör. MediaRecorder) WebM'lerde süre bilinemez; çıktı boyutu sınırı yine geçerlidir.
        if (Number.isFinite(duration) && duration > MAX_VIDEO_DURATION_SECONDS) throw new VideoRejectedError(TOO_LONG);
        await runTool(run, ffmpegPath(env), buildFfmpegArgs(inputPath, outputPath, kind), deps.timeoutMs ?? FFMPEG_TIMEOUT_MS);
        output = new Uint8Array(await readFile(outputPath));
        if (!isWebm(output)) throw new ToolFailure("ffmpeg çıktısı WebM değil");
      } catch (error) {
        if (!(error instanceof ToolFailure)) throw error;
        if (kind !== "webm") {
          log.warn(`Hero videosu dönüştürülemedi: ${error.message}`);
          throw new VideoRejectedError("Video dönüştürülemedi");
        }
        log.warn(`Hero videosu sıkıştırılamadı, orijinal WebM saklanıyor: ${error.message}`);
        return input;
      }

      const chosen = kind === "webm" && output.byteLength >= input.byteLength ? input : output;
      if (chosen.byteLength > MAX_VIDEO_BYTES) throw new VideoRejectedError(STILL_TOO_LARGE);
      return chosen;
    } finally {
      await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });
}
