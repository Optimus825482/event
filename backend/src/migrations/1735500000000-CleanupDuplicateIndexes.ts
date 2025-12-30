import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Database Index Cleanup Migration
 *
 * Bu migration duplicate ve gereksiz index'leri temizler.
 *
 * DUPLICATE INDEX'LER (composite index tarafından kapsanan):
 * 1. IDX_event_staff_assignment_event → IDX_event_staff_assignment_event_active tarafından kapsanıyor
 * 2. IDX_event_staff_assignment_staff → IDX_event_staff_assignment_staff_active tarafından kapsanıyor
 * 3. IDX_guest_note_customer → IDX_guest_note_customer_event tarafından kapsanıyor
 * 4. IDX_reservation_eventId → IDX_reservation_event_status tarafından kapsanıyor
 * 5. IDX_sp_staff_assignment_event → IDX_sp_staff_assignment_event_active tarafından kapsanıyor
 * 6. IDX_service_point_event → IDX_service_point_event_active tarafından kapsanıyor
 * 7. IDX_staff_assignment_event → IDX_staff_assignment_event_staff tarafından kapsanıyor
 * 8. IDX_table_group_event → IDX_table_group_event_order tarafından kapsanıyor
 * 9. IDX_dept_loc_department → UQ_department_location tarafından kapsanıyor
 * 10. IDX_dept_pos_department → UQ_department_position tarafından kapsanıyor
 * 11. IDX_20bb1a24bb90c15406d8e40137 → IDX_4843f1492981131e7a2a5659b5 tarafından kapsanıyor
 *
 * RARELY USED INDEX'LER (0 scan, düşük değer):
 * - IDX_reservation_status (tek başına status sorgusu nadir)
 * - IDX_reservation_guestPhone (nadir kullanım)
 *
 * KORUNAN INDEX'LER (önemli, silme):
 * - IDX_customer_search_name (GIN full-text search - gelecekte kullanılacak)
 * - IDX_staff_fullname_search (GIN full-text search - gelecekte kullanılacak)
 * - IDX_staff_sicil (UNIQUE constraint)
 * - IDX_departments_name (UNIQUE constraint)
 * - IDX_positions_name (UNIQUE constraint)
 * - IDX_work_locations_name (UNIQUE constraint)
 *
 * Tahmini Kazanım:
 * - ~500KB disk alanı tasarrufu
 * - INSERT/UPDATE performansı %5-10 artış
 * - Vacuum/Analyze süresi azalması
 */
export class CleanupDuplicateIndexes1735500000000
  implements MigrationInterface
{
  name = "CleanupDuplicateIndexes1735500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== DUPLICATE INDEX'LERİ SİL ====================

    // 1. event_staff_assignments - eventId tek başına gereksiz (composite var)
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_event_staff_assignment_event"`
    );

    // 2. event_staff_assignments - staffId tek başına gereksiz (composite var)
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_event_staff_assignment_staff"`
    );

    // 3. guest_notes - customerId tek başına gereksiz (composite var)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_guest_note_customer"`);

    // 4. reservations - eventId tek başına gereksiz (composite var)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reservation_eventId"`);

    // 5. service_point_staff_assignments - eventId tek başına gereksiz
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sp_staff_assignment_event"`
    );

    // 6. service_points - eventId tek başına gereksiz
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_point_event"`);

    // 7. staff_assignments - eventId tek başına gereksiz
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_staff_assignment_event"`
    );

    // 8. table_groups - eventId tek başına gereksiz
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_table_group_event"`);

    // 9. department_locations - departmentId (UQ constraint zaten var)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dept_loc_department"`);

    // 10. department_positions - departmentId (UQ constraint zaten var)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dept_pos_department"`);

    // 11. staff_performance_reviews - staffId tek başına (unique composite var)
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_20bb1a24bb90c15406d8e40137"`
    );

    // ==================== RARELY USED INDEX'LERİ SİL ====================

    // reservations - status tek başına nadir kullanılır
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reservation_status"`);

    // reservations - guestPhone nadir kullanılır
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reservation_guestPhone"`
    );

    console.log("✅ 13 duplicate/unused index temizlendi");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Silinen index'leri geri oluştur (rollback için)

    await queryRunner.query(
      `CREATE INDEX "IDX_event_staff_assignment_event" ON "event_staff_assignments" ("eventId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_staff_assignment_staff" ON "event_staff_assignments" ("staffId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guest_note_customer" ON "guest_notes" ("customerId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservation_eventId" ON "reservations" ("eventId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sp_staff_assignment_event" ON "service_point_staff_assignments" ("eventId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_service_point_event" ON "service_points" ("eventId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_staff_assignment_event" ON "staff_assignments" ("eventId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_table_group_event" ON "table_groups" ("eventId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dept_loc_department" ON "department_locations" ("departmentId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dept_pos_department" ON "department_positions" ("departmentId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_20bb1a24bb90c15406d8e40137" ON "staff_performance_reviews" ("staffId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservation_status" ON "reservations" ("status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservation_guestPhone" ON "reservations" ("guestPhone")`
    );

    console.log("⏪ 13 index geri oluşturuldu (rollback)");
  }
}
