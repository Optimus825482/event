import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Bu migration, veritabanındaki duplicate/gereksiz index'leri temizler.
 * Bu index'ler başka index'ler tarafından zaten kapsanmaktadır.
 *
 * Temizlenen index'ler ve kapsayan index'ler:
 * - IDX_dept_loc_department → department_locations_departmentId_workLocationId_key
 * - IDX_dept_pos_department → department_positions_departmentId_positionId_key
 * - IDX_departments_name → departments_name_key
 * - IDX_event_staff_assignment_event → IDX_event_staff_assignment_event_active
 * - IDX_guest_note_customer → IDX_guest_note_customer_event
 * - IDX_positions_name → positions_name_key
 * - IDX_reservation_eventId → IDX_reservation_event_table
 * - IDX_sp_staff_assignment_event → IDX_sp_staff_assignment_event_active
 * - IDX_service_point_event → IDX_service_point_event_active
 * - IDX_staff_sicil → staff_sicilNo_key
 * - IDX_staff_assignment_event → IDX_staff_assignment_event_staff
 * - IDX_20bb1a24bb90c15406d8e40137 → IDX_4843f1492981131e7a2a5659b5
 * - IDX_work_locations_name → work_locations_name_key
 */
export class CleanupDuplicateIndexes1735900000000
  implements MigrationInterface
{
  name = "CleanupDuplicateIndexes1735900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Her index'i silmeden önce var olup olmadığını kontrol et
    const indexesToDrop = [
      { table: "department_locations", index: "IDX_dept_loc_department" },
      { table: "department_positions", index: "IDX_dept_pos_department" },
      { table: "departments", index: "IDX_departments_name" },
      {
        table: "event_staff_assignments",
        index: "IDX_event_staff_assignment_event",
      },
      { table: "guest_notes", index: "IDX_guest_note_customer" },
      { table: "positions", index: "IDX_positions_name" },
      { table: "reservations", index: "IDX_reservation_eventId" },
      {
        table: "service_point_staff_assignments",
        index: "IDX_sp_staff_assignment_event",
      },
      { table: "service_points", index: "IDX_service_point_event" },
      { table: "staff", index: "IDX_staff_sicil" },
      { table: "staff_assignments", index: "IDX_staff_assignment_event" },
      {
        table: "staff_performance_reviews",
        index: "IDX_20bb1a24bb90c15406d8e40137",
      },
      { table: "work_locations", index: "IDX_work_locations_name" },
    ];

    for (const { table, index } of indexesToDrop) {
      const indexExists = await queryRunner.query(`
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = '${table}' 
        AND indexname = '${index}'
      `);

      if (indexExists.length > 0) {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."${index}"`);
        console.log(`✓ Dropped duplicate index: ${index} on ${table}`);
      } else {
        console.log(`⊘ Index already removed: ${index} on ${table}`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: Index'leri yeniden oluştur
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dept_loc_department" 
      ON "department_locations" ("departmentId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dept_pos_department" 
      ON "department_positions" ("departmentId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_departments_name" 
      ON "departments" ("name")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_event_staff_assignment_event" 
      ON "event_staff_assignments" ("eventId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_guest_note_customer" 
      ON "guest_notes" ("customerId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_positions_name" 
      ON "positions" ("name")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reservation_eventId" 
      ON "reservations" ("eventId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sp_staff_assignment_event" 
      ON "service_point_staff_assignments" ("eventId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_point_event" 
      ON "service_points" ("eventId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_staff_sicil" 
      ON "staff" ("sicilNo")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_staff_assignment_event" 
      ON "staff_assignments" ("eventId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_20bb1a24bb90c15406d8e40137" 
      ON "staff_performance_reviews" ("eventId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_work_locations_name" 
      ON "work_locations" ("name")
    `);
  }
}
