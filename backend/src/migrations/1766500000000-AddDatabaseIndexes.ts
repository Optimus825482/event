import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * EventFlow PRO - Additional Database Index Optimization Migration
 *
 * Bu migration ek indeksler ekler:
 * - Trigram indeks (fuzzy search için)
 * - Ek partial indeksler
 *
 * NOT: Duplicate indeksler kaldırıldı (önceki migration'da zaten var)
 */
export class AddDatabaseIndexes1766500000000 implements MigrationInterface {
  name = "AddDatabaseIndexes1766500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // GIN indeksler için extension kontrolü
    await queryRunner.query(
      `CREATE EXTENSION IF NOT EXISTS btree_gin WITH SCHEMA public`
    );
    await queryRunner.query(
      `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public`
    );

    // ============================================
    // CUSTOMERS TRIGRAM SEARCH İNDEKSİ
    // ============================================

    // Trigram indeks: fullName fuzzy search için
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_fullname_trgm"
      ON "customers" USING GIN ("fullName" gin_trgm_ops)
    `);

    console.log("✅ Ek indeksler başarıyla oluşturuldu!");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_customer_fullname_trgm"`
    );

    console.log("✅ Ek indeksler başarıyla silindi!");
  }
}
