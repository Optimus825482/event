import sharp from "sharp";

export async function pngFile(name = "gorsel.png"): Promise<{ name: string; mimeType: "image/png"; buffer: Buffer }> {
  const buffer = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#c9a227" } }).png().toBuffer();
  return { name, mimeType: "image/png", buffer };
}

export function textFile(name = "not.txt"): { name: string; mimeType: "text/plain"; buffer: Buffer } {
  return { name, mimeType: "text/plain", buffer: Buffer.from("merhaba") };
}
