/**
 * Users tablosunu temizle — sadece 3 admin kalacak
 * Tüm FK bağımlılıkları önce temizlenir
 *
 * Çalıştır: npx ts-node -r tsconfig-paths/register src/scripts/cleanup-users.ts
 */
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const ds = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "518518Erkan",
    database: process.env.DB_DATABASE || "eventflow",
    synchronize: false,
  });

  await ds.initialize();
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    // Kalacak 3 admin
    const admins = [
      "e32a3e9e-90c5-4a1b-a3e4-35353d9b404c", // admin@eventflow.com
      "518772a8-0368-42d5-8a05-92e00ee79eaa", // admin@test.com
      "acdda334-8da3-424e-8b33-32237d829827", // merit@merit.com
    ];
    const keepList = admins.map((id) => `'${id}'`).join(",");

    // Silinecek user sayısı
    const countRes = await qr.query(
      `SELECT COUNT(*) as cnt FROM users WHERE id NOT IN (${keepList})`,
    );
    console.log(`Silinecek user sayısı: ${countRes[0].cnt}`);

    // 1. FK bağımlılıkları temizle (sıralı)
    // notification_reads → CASCADE zaten ama explicit temizlik
    const nr = await qr.query(
      `DELETE FROM notification_reads WHERE "userId" NOT IN (${keepList})`,
    );
    console.log(`notification_reads silindi: ${nr[1]}`);

    // notifications → SET NULL zaten ama explicit
    const notif = await qr.query(
      `UPDATE notifications SET "createdById" = NULL WHERE "createdById" IS NOT NULL AND "createdById" NOT IN (${keepList})`,
    );
    console.log(`notifications createdById NULL yapıldı: ${notif[1]}`);

    // staff_performance_reviews → CASCADE on staffId, NO ACTION on reviewerId
    // Önce reviewerId'yi NULL yap (admin'e çevir veya NULL)
    const spr1 = await qr.query(
      `UPDATE staff_performance_reviews SET "reviewerId" = '${admins[0]}' WHERE "reviewerId" NOT IN (${keepList})`,
    );
    console.log(`staff_performance_reviews reviewerId güncellendi: ${spr1[1]}`);

    const spr2 = await qr.query(
      `DELETE FROM staff_performance_reviews WHERE "staffId" NOT IN (${keepList})`,
    );
    console.log(`staff_performance_reviews silindi: ${spr2[1]}`);

    // teams → leaderId
    const teams = await qr.query(
      `DELETE FROM teams WHERE "leaderId" NOT IN (${keepList})`,
    );
    console.log(`teams silindi: ${teams[1]}`);

    // staff_assignments → staffId
    const sa = await qr.query(
      `DELETE FROM staff_assignments WHERE "staffId" NOT IN (${keepList})`,
    );
    console.log(`staff_assignments silindi: ${sa[1]}`);

    // events → organizerId — admin'e ata
    const ev = await qr.query(
      `UPDATE events SET "organizerId" = '${admins[2]}' WHERE "organizerId" NOT IN (${keepList})`,
    );
    console.log(`events organizerId merit'e atandı: ${ev[1]}`);

    // invitation_templates → createdById NULL yap
    const it = await qr.query(
      `UPDATE invitation_templates SET "createdById" = NULL WHERE "createdById" IS NOT NULL AND "createdById" NOT IN (${keepList})`,
    );
    console.log(`invitation_templates createdById NULL yapıldı: ${it[1]}`);

    // organization_templates → createdById NULL yap
    const ot = await qr.query(
      `UPDATE organization_templates SET "createdById" = NULL WHERE "createdById" IS NOT NULL AND "createdById" NOT IN (${keepList})`,
    );
    console.log(`organization_templates createdById NULL yapıldı: ${ot[1]}`);

    // 2. Artık güvenle silebiliriz
    const del = await qr.query(
      `DELETE FROM users WHERE id NOT IN (${keepList})`,
    );
    console.log(`\n✅ Users silindi: ${del[1]}`);

    // 3. Doğrulama
    const remaining = await qr.query(
      `SELECT id, email, "fullName", role FROM users ORDER BY email`,
    );
    console.log(`\nKalan users (${remaining.length}):`);
    remaining.forEach((u: any) =>
      console.log(`  ${u.role} | ${u.email} | ${u.fullName}`),
    );

    await qr.commitTransaction();
    console.log("\n✅ Transaction commit edildi.");
  } catch (err) {
    await qr.rollbackTransaction();
    console.error("❌ Hata, rollback yapıldı:", err);
  } finally {
    await qr.release();
    await ds.destroy();
  }
}

main();
