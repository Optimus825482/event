import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import QRCode from "qrcode";

const WIDTH = 640;
const HEIGHT = 480;
const QUIET_MODULES = 4;
const WHITE = 235;
const BLACK = 16;

/**
 * Chromium'un sahte kamera akışı için `.y4m` dosyası üretir: ekranı dolduran, sessiz bölgeli bir QR kodunun
 * aynı kareleri (I420, 4:2:0). Kare verisi elle yazılır (ffmpeg gerekmez). QR, `qrcode` paketinin modül
 * matrisinden çizilir; her modül tam sayı piksel boyutundadır (keskin kenar).
 */
export function writeQrY4m(file: string, text: string, frames = 12, fps = 10): void {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const scale = Math.max(1, Math.floor(Math.min(WIDTH, HEIGHT) / (size + QUIET_MODULES * 2)));
  const span = (size + QUIET_MODULES * 2) * scale;
  const left = Math.floor((WIDTH - span) / 2);
  const top = Math.floor((HEIGHT - span) / 2);

  const luma = Buffer.alloc(WIDTH * HEIGHT, WHITE);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!qr.modules.get(row, col)) continue;
      const x0 = left + (col + QUIET_MODULES) * scale;
      const y0 = top + (row + QUIET_MODULES) * scale;
      for (let dy = 0; dy < scale; dy += 1) luma.fill(BLACK, (y0 + dy) * WIDTH + x0, (y0 + dy) * WIDTH + x0 + scale);
    }
  }
  const chroma = Buffer.alloc((WIDTH / 2) * (HEIGHT / 2), 128);
  const header = Buffer.from(`YUV4MPEG2 W${WIDTH} H${HEIGHT} F${fps}:1 Ip A1:1 C420jpeg\n`, "ascii");
  const frameTag = Buffer.from("FRAME\n", "ascii");
  const parts: Buffer[] = [header];
  for (let i = 0; i < frames; i += 1) parts.push(frameTag, luma, chroma, chroma);

  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, Buffer.concat(parts));
}
