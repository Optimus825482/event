import path from "node:path";

/**
 * Yüklenen dosyaların kök dizini: `UPLOAD_DIR` ya da `<cwd>/uploads`. Modül yüklenirken
 * bir kez çözülür; sonradan ortam değişkeni değişse de kök sabit kalır.
 */
export const UPLOAD_ROOT: string = path.resolve(
  /* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "uploads"),
);
