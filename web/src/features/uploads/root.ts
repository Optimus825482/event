import path from "node:path";

/**
 * Yüklenen dosyaların kök dizini: `UPLOAD_DIR` ya da `<cwd>/uploads`. Modül yüklenirken
 * bir kez çözülür; sonradan ortam değişkeni değişse de kök sabit kalır.
 */
export const UPLOAD_ROOT: string = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));
