/**
 * users tablosundaki staff rolündeki kayıtları staff tablosuna senkronize eder.
 * Sadece staff tablosunda olmayan kişileri ekler.
 *
 * Çalıştırma: npx ts-node src/scripts/sync-users-to-staff.ts
 */
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
dotenv.config();

const dataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "eventflow",
});

async function main() {
  await dataSource.initialize();
  console.log("DB bağlantısı kuruldu.");

  const qr = dataSource.createQueryRunner();

  // 1) Eksik kişileri bul
  const missing = await qr.query(`
    SELECT u.id as user_id, u."fullName", u.email, u.phone, u.avatar,
           u.position, u.color, u."isActive", u."createdAt"
    FROM users u
    WHERE u.role = 'staff'
    AND NOT EXISTS (
      SELECT 1 FROM staff s
      WHERE LOWER(TRIM(s."fullName")) = LOWER(TRIM(u."fullName"))
    )
    ORDER BY u."fullName"
  `);

  console.log(`${missing.length} eksik personel bulundu.`);

  if (missing.length === 0) {
    console.log("Eklenecek kayıt yok.");
    await dataSource.destroy();
    return;
  }

  // 2) Mevcut max AUTO- numarasını bul
  const maxResult = await qr.query(`
    SELECT COALESCE(MAX(CAST(SUBSTRING("sicilNo" FROM '[0-9]+$') AS INTEGER)), 0) as max_num
    FROM staff WHERE "sicilNo" LIKE 'AUTO-%'
  `);
  let nextNum = (maxResult[0]?.max_num || 126) + 1;

  // 3) Tek tek ekle
  let inserted = 0;
  for (const row of missing) {
    const sicilNo = `AUTO-${nextNum}`;
    const position = row.position?.trim() || "Personel";

    try {
      await qr.query(
        `INSERT INTO staff (id, "sicilNo", "fullName", email, phone, avatar, position, color, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          sicilNo,
          row.fullName?.trim(),
          row.email,
          row.phone,
          row.avatar,
          position,
          row.color,
          row.isActive ?? false,
          row.createdAt,
        ],
      );
      inserted++;
      nextNum++;
    } catch (err: any) {
      console.error(`HATA [${row.fullName}]: ${err.message}`);
    }
  }

  console.log(
    `✅ ${inserted}/${missing.length} personel staff tablosuna eklendi.`,
  );
  await dataSource.destroy();
}

main().catch((err) => {
  console.error("Script hatası:", err);
  process.exit(1);
});
