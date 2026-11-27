import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  buildFfmpegArgs,
  buildFfprobeArgs,
  compressHeroVideo,
  ffmpegPath,
  ffprobePath,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_INPUT_BYTES,
  runProcess,
  sniffVideo,
  VIDEO_CRF,
  type Runner,
} from "@/features/uploads/video-compress";
import { isWebm, MAX_VIDEO_BYTES, VideoRejectedError } from "@/features/uploads/videos";
import { ebml } from "../../helpers/webm";

/** `ftyp` kutusu: boyut + "ftyp" + ana marka + küçük sürüm + uyumlu markalar. */
function ftyp(major: string, compatible: string[] = [], tail = Buffer.alloc(32, 0x22)): Buffer {
  const brands = Buffer.from([major, ...compatible].map((b) => b.padEnd(4, " ")).join(""), "latin1");
  const body = Buffer.concat([brands.subarray(0, 4), Buffer.alloc(4), brands.subarray(4)]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(8 + body.length);
  return Buffer.concat([size, Buffer.from("ftyp", "latin1"), body, tail]);
}

const silent = { warn: () => undefined };

/** Sahte süreç çalıştırıcı: ffprobe süreyi döner, ffmpeg çıktı dosyasına verilen baytları yazar. */
function fakeRunner(opts: { duration?: string; output?: Buffer; ffmpegCode?: number; probeCode?: number }): Runner {
  return vi.fn(async (cmd: string, args: string[]) => {
    if (cmd.includes("ffprobe")) {
      return { code: opts.probeCode ?? 0, stdout: `${opts.duration ?? "5.0"}\n`, stderr: "" };
    }
    const out = args[args.length - 1]!;
    if ((opts.ffmpegCode ?? 0) === 0) {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(out, opts.output ?? ebml("webm", Buffer.alloc(16)));
    }
    return { code: opts.ffmpegCode ?? 0, stdout: "", stderr: "hata ayrıntısı" };
  });
}

const enoent: Runner = async () => {
  throw Object.assign(new Error("spawn ffmpeg ENOENT"), { code: "ENOENT" });
};

describe("sniffVideo", () => {
  it("WebM, MP4 (isom/mp42/avc1) ve MOV (qt) içeriğe göre tanınır", () => {
    expect(sniffVideo(ebml("webm"))).toBe("webm");
    expect(sniffVideo(ftyp("isom", ["iso2", "avc1", "mp41"]))).toBe("mp4");
    expect(sniffVideo(ftyp("mp42", ["isom"]))).toBe("mp4");
    expect(sniffVideo(ftyp("avc1"))).toBe("mp4");
    expect(sniffVideo(ftyp("qt"))).toBe("mov");
  });

  it("ana marka bilinmiyorsa uyumlu markalara bakılır", () => {
    expect(sniffVideo(ftyp("XAVC", ["mp42", "iso2"]))).toBe("mp4");
    expect(sniffVideo(ftyp("abcd", ["qt"]))).toBe("mov");
  });

  it("HEIC/AVIF görselleri, Matroska ve rastgele içerik video sayılmaz", () => {
    expect(sniffVideo(ftyp("heic", ["mif1", "heic"]))).toBeNull();
    expect(sniffVideo(ftyp("avif", ["mif1", "miaf"]))).toBeNull();
    expect(sniffVideo(ebml("matroska"))).toBeNull();
    expect(sniffVideo(Buffer.from("<html>ftypisom</html>"))).toBeNull();
    expect(sniffVideo(Buffer.alloc(0))).toBeNull();
  });
});

describe("girdi güvenliği", () => {
  it("ffmpeg ve ffprobe yalnız file protokolüne izin verir, demuxer koklanan türe sabitlenir", () => {
    for (const [kind, demuxer] of [["webm", "matroska"], ["mp4", "mov"], ["mov", "mov"]] as const) {
      for (const args of [buildFfmpegArgs("/t/girdi", "/t/c.webm", kind), buildFfprobeArgs("/t/girdi", kind)]) {
        const i = args.indexOf("-i");
        expect(args.slice(i - 4, i + 2)).toEqual(["-protocol_whitelist", "file", "-f", demuxer, "-i", "file:/t/girdi"]);
      }
    }
  });
});

describe("buildFfmpegArgs", () => {
  const args = buildFfmpegArgs("/t/girdi", "/t/cikti.webm", "mp4");
  const after = (flag: string) => args[args.indexOf(flag) + 1];

  it("VP9, sabit kalite CRF (b:v 0), yuv420p ve WebM kabı kullanır", () => {
    expect(after("-c:v")).toBe("libvpx-vp9");
    expect(after("-crf")).toBe(String(VIDEO_CRF));
    expect(after("-b:v")).toBe("0");
    expect(after("-pix_fmt")).toBe("yuv420p");
    expect(args[args.length - 2]).toBe("webm");
    expect(args[args.length - 3]).toBe("-f");
    expect(after("-deadline")).toBe("good");
    expect(after("-row-mt")).toBe("1");
  });

  it("CRF görsel olarak kayıpsıza yakın aralıktadır (30–33)", () => {
    expect(VIDEO_CRF).toBeGreaterThanOrEqual(30);
    expect(VIDEO_CRF).toBeLessThanOrEqual(33);
  });

  it("ses, altyazı ve metadata atılır", () => {
    expect(args).toContain("-an");
    expect(args).toContain("-sn");
    expect(after("-map_metadata")).toBe("-1");
    expect(after("-map")).toBe("0:v:0");
  });

  it("en uzun kenar 1280 px, büyütme yok, çift boyut; kare hızı en fazla 30", () => {
    const vf = after("-vf")!;
    expect(vf).toContain("min(1280,iw)");
    expect(vf).toContain("min(1280,ih)");
    expect(vf).toContain("force_original_aspect_ratio=decrease");
    expect(vf).toContain("force_divisible_by=2");
    expect(after("-fpsmax")).toBe("30");
  });

  it("girdi -i ardından, çıktı en sonda gelir; etkileşim kapalıdır", () => {
    expect(after("-i")).toBe("file:/t/girdi");
    expect(args[args.length - 1]).toBe("/t/cikti.webm");
    expect(args).toContain("-nostdin");
  });
});

describe("ffmpeg yolu", () => {
  it("FFMPEG_PATH yoksa PATH üzerindeki ffmpeg/ffprobe kullanılır", () => {
    expect(ffmpegPath({})).toBe("ffmpeg");
    expect(ffprobePath({})).toBe("ffprobe");
  });

  it("FFMPEG_PATH verilirse ffprobe aynı klasörden alınır; FFPROBE_PATH önceliklidir", () => {
    expect(ffmpegPath({ FFMPEG_PATH: "/opt/ff/ffmpeg" })).toBe("/opt/ff/ffmpeg");
    expect(ffprobePath({ FFMPEG_PATH: "/opt/ff/ffmpeg" })).toBe(path.join("/opt/ff", "ffprobe"));
    expect(ffprobePath({ FFMPEG_PATH: "C:\\ff\\ffmpeg.exe" })).toMatch(/ffprobe\.exe$/);
    expect(ffprobePath({ FFMPEG_PATH: "/opt/ff/ffmpeg", FFPROBE_PATH: "/x/probe" })).toBe("/x/probe");
  });
});

describe("compressHeroVideo (sahte süreçlerle)", () => {
  const bigWebm = ebml("webm", Buffer.alloc(4096, 0x33));

  it("sıkıştırılmış çıktı küçükse o döner", async () => {
    const small = ebml("webm", Buffer.alloc(100));
    const out = await compressHeroVideo(bigWebm, { run: fakeRunner({ output: small }), log: silent });
    expect(Buffer.from(out).equals(small)).toBe(true);
  });

  it("WebM girdide sıkıştırılmış çıktı orijinalden büyükse orijinal saklanır", async () => {
    const input = ebml("webm", Buffer.alloc(10));
    const out = await compressHeroVideo(input, {
      run: fakeRunner({ output: ebml("webm", Buffer.alloc(5000)) }),
      log: silent,
    });
    expect(Buffer.from(out).equals(input)).toBe(true);
  });

  it("MP4 girdide çıktı büyük olsa da her zaman WebM döner", async () => {
    const webmOut = ebml("webm", Buffer.alloc(5000));
    const out = await compressHeroVideo(ftyp("isom"), { run: fakeRunner({ output: webmOut }), log: silent });
    expect(isWebm(out)).toBe(true);
  });

  it("ffmpeg yoksa WebM orijinal saklanır ve uyarı günlüğe yazılır", async () => {
    const warn = vi.fn();
    const out = await compressHeroVideo(bigWebm, { run: enoent, log: { warn } });
    expect(Buffer.from(out).equals(bigWebm)).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it("ffmpeg yoksa MP4/MOV 'Video dönüştürülemedi' hatasıyla reddedilir", async () => {
    for (const input of [ftyp("mp42"), ftyp("qt")]) {
      await expect(compressHeroVideo(input, { run: enoent, log: silent })).rejects.toThrow(
        new VideoRejectedError("Video dönüştürülemedi"),
      );
    }
  });

  it("ffmpeg hata koduyla biterse WebM orijinal, MP4 hata olur", async () => {
    const run = fakeRunner({ ffmpegCode: 1 });
    const out = await compressHeroVideo(bigWebm, { run, log: silent });
    expect(Buffer.from(out).equals(bigWebm)).toBe(true);
    await expect(compressHeroVideo(ftyp("isom"), { run, log: silent })).rejects.toThrow("Video dönüştürülemedi");
  });

  it("60 sn'den uzun video reddedilir, ffmpeg çalıştırılmaz", async () => {
    const run = fakeRunner({ duration: String(MAX_VIDEO_DURATION_SECONDS + 0.5) });
    await expect(compressHeroVideo(bigWebm, { run, log: silent })).rejects.toThrow(/60 saniye/);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("tam 60 sn kabul edilir", async () => {
    const run = fakeRunner({ duration: "60.000" });
    await expect(compressHeroVideo(bigWebm, { run, log: silent })).resolves.toBeTruthy();
  });

  it("50 MB üstü girdi süreç başlatılmadan reddedilir", async () => {
    const run = fakeRunner({});
    const huge = Buffer.concat([ebml("webm", Buffer.alloc(0)), Buffer.alloc(MAX_VIDEO_INPUT_BYTES)]);
    await expect(compressHeroVideo(huge, { run, log: silent })).rejects.toThrow(/50 MB/);
    expect(run).not.toHaveBeenCalled();
  });

  it("desteklenmeyen içerik reddedilir", async () => {
    await expect(compressHeroVideo(Buffer.from("metin"), { run: fakeRunner({}), log: silent })).rejects.toThrow(
      "Yalnızca WebM, MP4 veya MOV videolar yüklenebilir",
    );
  });

  it("sıkıştırılmış çıktı 15 MB'ı aşarsa Türkçe hata verilir", async () => {
    const tooBig = ebml("webm", Buffer.alloc(MAX_VIDEO_BYTES + 1));
    await expect(compressHeroVideo(ftyp("isom"), { run: fakeRunner({ output: tooBig }), log: silent })).rejects.toThrow(
      "Video sıkıştırıldıktan sonra da 15 MB'ı aşıyor; daha kısa bir video yükleyin.",
    );
  });

  it("aynı anda en fazla bir dönüştürme çalışır", async () => {
    let active = 0;
    let peak = 0;
    const base = fakeRunner({});
    const run: Runner = async (cmd, args, opts) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 15));
      try {
        return await base(cmd, args, opts);
      } finally {
        active--;
      }
    };
    await Promise.all([1, 2, 3].map(() => compressHeroVideo(bigWebm, { run, log: silent })));
    expect(peak).toBe(1);
  });

  it("bir dönüştürme hata verse de kuyruk sonrakileri çalıştırır", async () => {
    await expect(compressHeroVideo(ftyp("isom"), { run: enoent, log: silent })).rejects.toThrow();
    await expect(compressHeroVideo(bigWebm, { run: fakeRunner({}), log: silent })).resolves.toBeTruthy();
  });

  it("geçici dosyalar iş bitince silinir", async () => {
    const seen: string[] = [];
    const base = fakeRunner({});
    const run: Runner = async (cmd, args, opts) => {
      seen.push(path.dirname(args[args.length - 1]!));
      return base(cmd, args, opts);
    };
    await compressHeroVideo(bigWebm, { run, log: silent });
    expect(seen.length).toBeGreaterThan(0);
    for (const dir of seen) expect(existsSync(dir)).toBe(false);
  });
});

describe("runProcess", () => {
  it("zaman aşımında süreci öldürür ve reddeder", async () => {
    const started = Date.now();
    await expect(
      runProcess(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], { timeoutMs: 200 }),
    ).rejects.toThrow(/200 ms/);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("kabuk kullanmaz: argümanlar olduğu gibi geçer", async () => {
    const r = await runProcess(process.execPath, ["-e", "process.stdout.write(process.argv[1])", "a;b && $(c)"], {
      timeoutMs: 10_000,
    });
    expect(r).toMatchObject({ code: 0, stdout: "a;b && $(c)" });
  });
});

describe("compressHeroVideo (gerçek süreç)", () => {
  it("FFMPEG_PATH var olmayan bir dosyayı gösterirse WebM orijinal saklanır", async () => {
    const input = ebml("webm");
    const missing = path.join(tmpdir(), "yok-boyle-ffmpeg", "ffmpeg");
    const out = await compressHeroVideo(input, { env: { FFMPEG_PATH: missing }, log: silent });
    expect(Buffer.from(out).equals(input)).toBe(true);
  });
});

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;

describe("compressHeroVideo (gerçek ffmpeg)", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "hero-video-test-"));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  function probe(bytes: Uint8Array): { width: number; height: number; fps: string; audio: boolean } {
    const file = path.join(dir, `p-${Math.random().toString(36).slice(2)}.webm`);
    writeFileSync(file, bytes);
    const r = spawnSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", file], { encoding: "utf8" });
    const streams = JSON.parse(r.stdout).streams as { codec_type: string; width?: number; height?: number; r_frame_rate?: string; codec_name: string }[];
    const v = streams.find((s) => s.codec_type === "video")!;
    expect(v.codec_name).toBe("vp9");
    return { width: v.width!, height: v.height!, fps: v.r_frame_rate!, audio: streams.some((s) => s.codec_type === "audio") };
  }

  it.skipIf(!hasFfmpeg)(
    "sesli 60 fps 2560x1440 MP4'ü sessiz, 30 fps, 1280x720 VP9 WebM'e dönüştürür",
    async () => {
      const src = path.join(dir, "kaynak.mp4");
      const r = spawnSync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", "testsrc=size=2560x1440:rate=60:duration=1",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", src,
      ]);
      expect(r.status).toBe(0);
      const input = readFileSync(src);
      expect(sniffVideo(input)).toBe("mp4");

      const out = await compressHeroVideo(input, { log: silent });
      expect(isWebm(out)).toBe(true);
      const info = probe(out);
      expect([info.width, info.height]).toEqual([1280, 720]);
      expect(info.fps).toBe("30/1");
      expect(info.audio).toBe(false);
    },
    60_000,
  );

  it.skipIf(!hasFfmpeg)(
    "dikey küçük video büyütülmez",
    async () => {
      const src = path.join(dir, "dikey.mov");
      const r = spawnSync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", "testsrc=size=360x640:rate=25:duration=1",
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-f", "mov", src,
      ]);
      expect(r.status).toBe(0);
      const input = readFileSync(src);
      expect(sniffVideo(input)).toBe("mov");
      const info = probe(await compressHeroVideo(input, { log: silent }));
      expect([info.width, info.height]).toEqual([360, 640]);
      expect(info.fps).toBe("25/1");
    },
    60_000,
  );
});
