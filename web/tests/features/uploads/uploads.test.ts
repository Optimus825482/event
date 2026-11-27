import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteImage, ImageRejectedError, MAX_ANIMATION_FRAMES, MAX_IMAGE_BYTES, saveImage } from "@/features/uploads/images";
import { resolveUploadPath, serveUpload } from "@/features/uploads/serve";
import { saveVideo } from "@/features/uploads/videos";
import { WEBM_BYTES } from "../../helpers/webm";

let root: string;

// Windows'ta sharp önbelleği dosya tutamaçlarını açık tutup geçici dizin silmeyi engelleyebilir.
sharp.cache(false);

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "eventflow-uploads-"));
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function png(width = 40, height = 30): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: "#ff0000" } })
    .png()
    .toBuffer();
}
const asFile = (data: Buffer | string, name: string, type: string) =>
  new File([typeof data === "string" ? data : new Uint8Array(data)], name, { type });
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("saveImage", () => {
  it("PNG uzantılı HTML dosyası reddedilir ve diske hiçbir şey yazılmaz", async () => {
    const html = asFile("<html><script>alert(1)</script></html>", "foto.png", "image/png");
    await expect(saveImage(html, "avatar", root)).rejects.toBeInstanceOf(ImageRejectedError);
    const dir = path.join(root, "avatar");
    expect(existsSync(dir) ? readdirSync(dir) : []).toHaveLength(0);
  });

  it("SVG ve GIF reddedilir", async () => {
    const svg = asFile('<svg xmlns="http://www.w3.org/2000/svg"/>', "a.svg", "image/svg+xml");
    await expect(saveImage(svg, "logo", root)).rejects.toBeInstanceOf(ImageRejectedError);
    const gif = asFile(Buffer.from("474946383961010001000000003b", "hex"), "a.gif", "image/gif");
    await expect(saveImage(gif, "logo", root)).rejects.toBeInstanceOf(ImageRejectedError);
  });

  it("imzası geçerli ama bozuk görüntü reddedilir", async () => {
    const fake = asFile(Buffer.concat([PNG_SIGNATURE, Buffer.alloc(32)]), "a.png", "image/png");
    await expect(saveImage(fake, "event", root)).rejects.toBeInstanceOf(ImageRejectedError);
  });

  it("5 MB üstü dosya reddedilir", async () => {
    const big = Buffer.concat([await png(), Buffer.alloc(MAX_IMAGE_BYTES)]);
    await expect(saveImage(asFile(big, "b.png", "image/png"), "event", root)).rejects.toThrow(/5 MB/);
  });

  it("PNG'yi WebP'ye çevirir, rastgele adla ve tür klasörü altında saklar", async () => {
    const a = await saveImage(asFile(await png(), "kullanici adi.png", "image/png"), "avatar", root);
    const b = await saveImage(asFile(await png(), "kullanici adi.png", "image/png"), "avatar", root);
    expect(a.path).toMatch(/^avatar\/[0-9a-f-]{36}\.webp$/);
    expect(a.path).not.toBe(b.path);
    expect(a.path).not.toContain("kullanici");
    const bytes = readFileSync(path.join(root, a.path));
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("JPEG ve WebP girdileri kabul edilir; büyük görüntü küçültülür", async () => {
    const jpeg = await sharp({ create: { width: 3000, height: 100, channels: 3, background: "#00f" } })
      .jpeg()
      .toBuffer();
    const saved = await saveImage(asFile(jpeg, "x.jpg", "image/jpeg"), "invitation", root);
    const meta = await sharp(path.join(root, saved.path)).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBeLessThanOrEqual(2048);

    const webp = await sharp(await png()).webp().toBuffer();
    await expect(saveImage(asFile(webp, "x.webp", "image/webp"), "logo", root)).resolves.toBeTruthy();
  });

  async function animatedWebp(frames: number, width = 40, height = 30): Promise<Buffer> {
    const colors = ["#f00", "#0f0", "#00f"];
    const inputs = await Promise.all(
      Array.from({ length: frames }, (_, i) =>
        sharp({ create: { width, height, channels: 3, background: colors[i % colors.length]! } })
          .png()
          .toBuffer(),
      ),
    );
    return sharp(inputs, { join: { animated: true } }).webp({ delay: 100 }).toBuffer();
  }

  it("hareketli WebP animasyonu korunur; büyük kareler küçültülür", async () => {
    const small = await saveImage(asFile(await animatedWebp(3), "klip.webp", "image/webp"), "event", root);
    const meta = await sharp(path.join(root, small.path), { animated: true }).metadata();
    expect(meta.pages).toBe(3);
    expect(meta.pageHeight).toBe(30);

    const wide = await saveImage(asFile(await animatedWebp(2, 3000, 100), "genis.webp", "image/webp"), "event", root);
    const wideMeta = await sharp(path.join(root, wide.path), { animated: true }).metadata();
    expect(wideMeta.pages).toBe(2);
    expect(wideMeta.width).toBeLessThanOrEqual(2048);
  });

  it("kare sayısı sınırını aşan hareketli görüntü reddedilir", async () => {
    const tooMany = await animatedWebp(MAX_ANIMATION_FRAMES + 1, 4, 4);
    await expect(saveImage(asFile(tooMany, "uzun.webp", "image/webp"), "event", root)).rejects.toBeInstanceOf(
      ImageRejectedError,
    );
  });

  it("artist türü kabul edilir ve artist/ altına yazılır", async () => {
    const webp = await sharp(await png()).webp().toBuffer();
    const saved = await saveImage(asFile(webp, "sanatci.webp", "image/webp"), "artist", root);
    expect(saved.path).toMatch(/^artist\/[0-9a-f-]{36}\.webp$/);
  });
});

describe("deleteImage", () => {
  it("dosyayı siler; ikinci çağrı hata vermez", async () => {
    const { path: p } = await saveImage(asFile(await png(), "a.png", "image/png"), "event", root);
    await deleteImage(p, root);
    expect(existsSync(path.join(root, p))).toBe(false);
    await expect(deleteImage(p, root)).resolves.toBeUndefined();
  });

  it("kök dışına çıkan yolu reddeder ve dışarıdaki dosyaya dokunmaz", async () => {
    const outside = path.join(path.dirname(root), "dokunma.webp");
    writeFileSync(outside, "x");
    try {
      await expect(deleteImage("../dokunma.webp", root)).rejects.toThrow();
      expect(existsSync(outside)).toBe(true);
    } finally {
      rmSync(outside, { force: true });
    }
  });
});

describe("resolveUploadPath", () => {
  it.each([
    [["..", "x.webp"]],
    [["avatar", "..", "..", "x.webp"]],
    [["avatar", "a/../../x.webp"]],
    [["avatar\\..\\x.webp"]],
    [["avatar", "x.png"]],
    [["avatar", "x.webp\0.png"]],
    [["avatar", ""]],
    [["/etc/passwd"]],
    [[]],
  ])("%j reddedilir", (segments) => {
    expect(resolveUploadPath(root, segments)).toBeNull();
  });

  it("geçerli yolu kök altındaki mutlak yola çevirir", () => {
    expect(resolveUploadPath(root, ["avatar", "a.webp"])).toBe(path.join(root, "avatar", "a.webp"));
  });

  it("webm yolunu da kök altındaki mutlak yola çevirir", () => {
    expect(resolveUploadPath(root, ["event", "a.webm"])).toBe(path.join(root, "event", "a.webm"));
  });
});

describe("serveUpload", () => {
  it("../ içeren yol 404 döner", async () => {
    const secret = path.join(path.dirname(root), "gizli.webp");
    writeFileSync(secret, "x");
    try {
      expect((await serveUpload(root, ["..", "gizli.webp"])).status).toBe(404);
      expect((await serveUpload(root, ["avatar", "..", "..", "gizli.webp"])).status).toBe(404);
    } finally {
      rmSync(secret, { force: true });
    }
  });

  it("webp dosyasını güvenlik başlıklarıyla sunar", async () => {
    const { path: p } = await saveImage(asFile(await png(), "a.png", "image/png"), "logo", root);
    const res = await serveUpload(root, p.split("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toMatch(/^private/);
    expect(Buffer.from(await res.arrayBuffer()).subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("webm dosyasını video/webm türüyle ve bayt aralığı desteğiyle sunar", async () => {
    const { path: p } = await saveVideo(new File([new Uint8Array(WEBM_BYTES)], "v.webm"), root);
    const full = await serveUpload(root, p.split("/"));
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("video/webm");
    expect(full.headers.get("accept-ranges")).toBe("bytes");
    expect(full.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await full.arrayBuffer()).equals(WEBM_BYTES)).toBe(true);

    const part = await serveUpload(root, p.split("/"), new Headers({ range: "bytes=0-3" }));
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 0-3/${WEBM_BYTES.length}`);
    expect(part.headers.get("content-length")).toBe("4");
    expect([...new Uint8Array(await part.arrayBuffer())]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  });

  it("webp olmayan dosya ve olmayan dosya 404 döner", async () => {
    mkdirSync(path.join(root, "avatar"), { recursive: true });
    writeFileSync(path.join(root, "avatar", "eski.png"), "x");
    expect((await serveUpload(root, ["avatar", "eski.png"])).status).toBe(404);
    expect((await serveUpload(root, ["avatar", "yok.webp"])).status).toBe(404);
    expect((await serveUpload(root, ["avatar"])).status).toBe(404);
  });
});
