/**
 * personnel_images_correct klasöründeki resimleri staff tablosuna base64 olarak yazar.
 * Dosya adı formatı: sicilNo_FullName.jpeg (ör: 14402_Ozgur Ozgun.jpeg)
 * Bazı sicil numaralarında X/x suffix'i var — temizlenir.
 *
 * Çalıştırma: npx ts-node src/scripts/sync-images-to-staff.ts
 */
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const dataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "eventflow",
});

const IMAGES_DIR = path.resolve(__dirname, "../../../personnel_images_correct");

async function main() {
  await dataSource.initialize();
  console.log("DB bağlantısı kuruldu.");

  const files = fs
    .readdirSync(IMAGES_DIR)
    .filter((f) => /\.(jpe?g|png)$/i.test(f));
  console.log(`${files.length} resim dosyası bulundu.`);

  const qr = dataSource.createQueryRunner();
  let matched = 0;
  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const file of files) {
    // Dosya adından sicil numarasını çıkar: "14402_Ozgur Ozgun.jpeg" → "14402"
    const underscoreIdx = file.indexOf("_");
    if (underscoreIdx === -1) {
      console.warn(`⚠ Format hatası (alt çizgi yok): ${file}`);
      continue;
    }

    // rawSicil: "12500x", "3748XX", "14402" vb.
    const rawSicil = file.substring(0, underscoreIdx);
    const cleanSicil = rawSicil.replace(/[Xx]+$/, "");

    // Dosya adından ismi çıkar: "Ozgur Ozgun.jpeg" → "Ozgur Ozgun"
    const nameFromFile = file
      .substring(underscoreIdx + 1)
      .replace(/\.(jpe?g|png)$/i, "")
      .trim();

    // DB'de ara: önce rawSicil (X'li), sonra cleanSicil, sonra isim eşleştirmesi
    const rows = await qr.query(
      `SELECT id, "sicilNo", "fullName", 
              CASE WHEN avatar IS NOT NULL AND avatar != '' THEN true ELSE false END as has_avatar
       FROM staff 
       WHERE "sicilNo" = $1 
          OR "sicilNo" = $2
          OR "sicilNo" = $3
       LIMIT 1`,
      [rawSicil, cleanSicil, rawSicil.toUpperCase()],
    );

    // Hâlâ bulunamadıysa isimle dene (Türkçe karakter normalize)
    if (rows.length === 0) {
      const nameRows = await qr.query(
        `SELECT id, "sicilNo", "fullName",
                CASE WHEN avatar IS NOT NULL AND avatar != '' THEN true ELSE false END as has_avatar
         FROM staff
         WHERE LOWER(TRANSLATE("fullName", 'çğıöşüÇĞİÖŞÜâêîôûÂÊÎÔÛ', 'cgiosuCGIOSUaeiouAEIOU'))
             = LOWER($1)
         LIMIT 1`,
        [nameFromFile],
      );
      if (nameRows.length > 0) {
        rows.push(...nameRows);
      }
    }

    if (rows.length === 0) {
      console.log(
        `✗ sicilNo=${rawSicil}/${cleanSicil} name=${nameFromFile} bulunamadı (${file})`,
      );
      notFound++;
      continue;
    }

    matched++;

    // Zaten avatarı varsa atla
    if (rows[0].has_avatar) {
      skipped++;
      continue;
    }

    // Resmi oku ve base64'e çevir
    const filePath = path.join(IMAGES_DIR, file);
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(file).toLowerCase().replace(".", "");
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    const base64 = `data:${mime};base64,${buffer.toString("base64")}`;

    try {
      await qr.query(
        `UPDATE staff SET avatar = $1, "updatedAt" = NOW() WHERE id = $2`,
        [base64, rows[0].id],
      );
      updated++;
      console.log(
        `✓ ${rows[0].fullName} (${rows[0].sicilNo}) — avatar güncellendi`,
      );
    } catch (err: any) {
      console.error(
        `HATA [${rows[0].sicilNo} ${rows[0].fullName}]: ${err.message}`,
      );
    }
  }

  console.log(`\n========== SONUÇ ==========`);
  console.log(`Toplam resim: ${files.length}`);
  console.log(`Eşleşen: ${matched}`);
  console.log(`Güncellenen: ${updated}`);
  console.log(`Zaten avatarı var (atlandı): ${skipped}`);
  console.log(`DB'de bulunamayan: ${notFound}`);

  await dataSource.destroy();
}

main().catch((err) => {
  console.error("Script hatası:", err);
  process.exit(1);
});
