// Derleme çıktısında (ikili dosyalar dahil) verilen iğnelerin geçtiği dosyaları bulur.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

function listFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

/**
 * `dir` altındaki tüm dosyaları `latin1` okuyarak tarar; iğnelerden birini içeren dosyaların
 * `dir`'e göreli (eğik çizgili) yollarını sıralı döndürür.
 * @param {string} dir
 * @param {readonly string[]} needles
 * @returns {string[]}
 */
export function findLeaks(dir, needles) {
  const leaks = [];
  for (const file of listFiles(dir)) {
    const content = readFileSync(file, "latin1");
    if (needles.some((needle) => content.includes(needle))) {
      leaks.push(relative(dir, file).split(sep).join("/"));
    }
  }
  return leaks.sort();
}
