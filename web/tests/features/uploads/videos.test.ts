import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isWebm, MAX_VIDEO_BYTES, saveVideo, VideoRejectedError } from "@/features/uploads/videos";
import { ebml } from "../../helpers/webm";

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "eventflow-videos-"));
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const asFile = (data: Buffer | string, name: string, type: string) =>
  new File([typeof data === "string" ? data : new Uint8Array(data)], name, { type });

function eventDirFiles(): string[] {
  const dir = path.join(root, "event");
  return existsSync(dir) ? readdirSync(dir) : [];
}

describe("isWebm", () => {
  it("EBML başlığı ve DocType webm olan içerik WebM sayılır", () => {
    expect(isWebm(ebml("webm"))).toBe(true);
  });

  it("Matroska (DocType matroska), boş ve rastgele içerik WebM sayılmaz", () => {
    expect(isWebm(ebml("matroska"))).toBe(false);
    expect(isWebm(Buffer.alloc(0))).toBe(false);
    expect(isWebm(Buffer.from("webm webm webm webm"))).toBe(false);
    expect(isWebm(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))).toBe(false);
  });

  it("DocType başlık sınırının dışında kalırsa WebM sayılmaz", () => {
    const b = ebml("webm");
    // Başlık boyutunu DocType'tan önce bitecek şekilde küçült.
    b[4] = 0x80 | 8;
    expect(isWebm(b)).toBe(false);
  });
});

describe("saveVideo", () => {
  it("boyut sınırı 15 MB'tır", () => {
    expect(MAX_VIDEO_BYTES).toBe(15 * 1024 * 1024);
  });

  it("WebM'i olduğu gibi event/<rastgele-uuid>.webm yoluna yazar", async () => {
    const bytes = ebml("webm");
    const a = await saveVideo(asFile(bytes, "tanitim videosu.webm", "video/webm"), root);
    const b = await saveVideo(asFile(bytes, "tanitim videosu.webm", "video/webm"), root);
    expect(a.path).toMatch(/^event\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webm$/);
    expect(a.path).not.toBe(b.path);
    expect(a.path).not.toContain("tanitim");
    expect(readFileSync(path.join(root, a.path)).equals(bytes)).toBe(true);
  });

  it("istemcinin bildirdiği türe güvenmez: webm adlı/türlü HTML reddedilir, diske yazılmaz", async () => {
    const before = eventDirFiles().length;
    const html = asFile("<html><script>alert(1)</script></html>", "a.webm", "video/webm");
    await expect(saveVideo(html, root)).rejects.toBeInstanceOf(VideoRejectedError);
    await expect(saveVideo(asFile(ebml("matroska"), "a.webm", "video/webm"), root)).rejects.toBeInstanceOf(
      VideoRejectedError,
    );
    expect(eventDirFiles()).toHaveLength(before);
  });

  it("15 MB üstü video reddedilir", async () => {
    const big = ebml("webm", Buffer.alloc(MAX_VIDEO_BYTES));
    await expect(saveVideo(asFile(big, "b.webm", "video/webm"), root)).rejects.toThrow(/15 MB/);
  });

  it("tam 15 MB video kabul edilir", async () => {
    const head = ebml("webm", Buffer.alloc(0));
    const exact = Buffer.concat([head, Buffer.alloc(MAX_VIDEO_BYTES - head.length)]);
    await expect(saveVideo(asFile(exact, "c.webm", "video/webm"), root)).resolves.toBeTruthy();
  });
});
