import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * EventFlow PRO - Database Index Optimization Migration
 *
 * Bu migration 15 yeni indeks ekler:
 * - 5 GIN indeks (array ve JSONB kolonları için)
 * - 7 B-tree indeks (composite ve partial)
 * - 3 Full-text search indeks
 *
 * CONCURRENTLY kullanılarak production'da downtime olmadan çalışır.
 * Tahmini süre: ~15-20 dakika (production data boyutuna göre)
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
    // 1. EVENT_STAFF_ASSIGNMENTS İNDEKSLERİ (CRITICAL)
    // ============================================

    // GIN indeks: tableIds array aramaları için
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_event_staff_assignment_tables"
      ON "event_staff_assignments" USING GIN ("tableIds")
    `);

    // Composite indeks: staffId + isActive (aktif atamalar için)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_event_staff_assignment_staff_active"
      ON "event_staff_assignments" ("staffId", "isActive")
    `);

    // Partial indeks: teamId (sadece NULL olmayan değerler)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_event_staff_assignment_team_partial"
      ON "event_staff_assignments" ("teamId")
      WHERE "teamId" IS NOT NULL
    `);

    // Partial indeks: shiftId (sadece NULL olmayan değerler)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_event_staff_assignment_shift_partial"
      ON "event_staff_assignments" ("shiftId")
      WHERE "shiftId" IS NOT NULL
    `);

    // ============================================
    // 2. TABLE_GROUPS İNDEKSLERİ (CRITICAL)
    // ============================================

    // GIN indeks: tableIds array aramaları için
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_table_group_tables"
      ON "table_groups" USING GIN ("tableIds")
    `);

    // Partial indeks: assignedSupervisorId (sadece NULL olmayan)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_table_group_supervisor_partial"
      ON "table_groups" ("assignedSupervisorId")
      WHERE "assignedSupervisorId" IS NOT NULL
    `);

    // Composite indeks: eventId + sortOrder (sıralı listeleme için)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_table_group_event_order"
      ON "table_groups" ("eventId", "sortOrder")
    `);

    // ============================================
    // 3. SERVICE_TEAMS İNDEKSLERİ (HIGH)
    // ============================================

    // GIN indeks: members JSONB aramaları için
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_service_team_members"
      ON "service_teams" USING GIN ("members")
    `);

    // GIN indeks: tableIds array aramaları için
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_service_team_tables"
      ON "service_teams" USING GIN ("tableIds")
    `);

    // Partial indeks: leaderId (sadece NULL olmayan)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_service_team_leader_partial"
      ON "service_teams" ("leaderId")
      WHERE "leaderId" IS NOT NULL
    `);

    // ============================================
    // 4. GUEST_NOTES İNDEKSLERİ (HIGH)
    // ============================================

    // Descending indeks: createdAt (son notlar için)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_guest_note_created_desc"
      ON "guest_notes" ("createdAt" DESC)
    `);

    // ============================================
    // 5. EVENTS JSONB İNDEKSLERİ (HIGH)
    // ============================================

    // GIN indeks: venueLayout JSONB (jsonb_path_ops - daha hızlı)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_event_venue_layout"
      ON "events" USING GIN ("venueLayout" jsonb_path_ops)
      WHERE "venueLayout" IS NOT NULL
    `);

    // Partial indeks: venueLayout var mı kontrolü
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_event_has_layout"
      ON "events" ("id")
      WHERE "venueLayout" IS NOT NULL
    `);

    // ============================================
    // 6. CUSTOMERS SEARCH İNDEKSLERİ (MEDIUM)
    // ============================================

    // Trigram indeks: fullName fuzzy search için
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_customer_fullname_trgm"
      ON "customers" USING GIN ("fullName" gin_trgm_ops)
    `);

    // ============================================
    // 7. SOFT DELETE İNDEKSLERİ (MEDIUM)
    // ============================================

    // Partial indeks: Aktif event_staff_assignments
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_event_staff_assignment_active_only"
      ON "event_staff_assignments" ("eventId", "staffId")
      WHERE "isActive" = true
    `);

    console.log("✅ Tüm indeksler başarıyla oluşturuldu!");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // İndeksleri ters sırada sil
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_event_staff_assignment_active_only"`
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_customer_fullname_trgm"`
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_event_has_layout"`
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_event_venue_layout"`
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_guest_note_created_desc"`
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_service_team_leader_partial"`
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_service_team_tables"`
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_service_team_members"`
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_table_group_event_order"`
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_table_group_supervisor_partial"`
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_table_group_tables"`
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_event_staff_assignment_shift_partial"`
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_event_staff_assignment_team_partial"`
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_event_staff_assignment_staff_active"`
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_event_staff_assignment_tables"`
    );

    console.log("✅ Tüm indeksler başarıyla silindi!");
  }
}
