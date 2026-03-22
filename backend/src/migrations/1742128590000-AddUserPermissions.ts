import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from "typeorm";

export class AddUserPermissions1711123456789 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // user_permissions tablosunu oluştur
    await queryRunner.createTable(
      new Table({
        name: "user_permissions",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "userId",
            type: "uuid",
          },
          {
            name: "module",
            type: "enum",
            enum: [
              "events",
              "reservations",
              "check_in",
              "staff",
              "customers",
              "venues",
              "settings",
              "users",
              "invitations",
              "notifications",
            ],
          },
          {
            name: "canView",
            type: "boolean",
            default: true,
          },
          {
            name: "canCreate",
            type: "boolean",
            default: false,
          },
          {
            name: "canEdit",
            type: "boolean",
            default: false,
          },
          {
            name: "canDelete",
            type: "boolean",
            default: false,
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "now()",
          },
          {
            name: "updatedAt",
            type: "timestamp",
            default: "now()",
          },
        ],
      }),
      true,
    );

    // Foreign key ekle
    await queryRunner.createForeignKey(
      "user_permissions",
      new TableForeignKey({
        columnNames: ["userId"],
        referencedColumnNames: ["id"],
        referencedTableName: "users",
        onDelete: "CASCADE",
      }),
    );

    // Index ekle (performans için)
    await queryRunner.query(`
      CREATE INDEX "IDX_user_permissions_userId_module" 
      ON "user_permissions" ("userId", "module");
    `);

    // Mevcut admin kullanıcılarına tüm yetkileri ver
    await queryRunner.query(`
      INSERT INTO user_permissions (userId, module, "canView", "canCreate", "canEdit", "canDelete")
      SELECT 
        u.id,
        m.module,
        true,
        true,
        true,
        true
      FROM users u
      CROSS JOIN (
        SELECT unnest(ARRAY[
          'events', 'reservations', 'check_in', 'staff', 
          'customers', 'venues', 'settings', 'users', 
          'invitations', 'notifications'
        ]::text[]) as module
      ) m
      WHERE u.role = 'admin';
    `);

    // Organizer kullanıcılarına temel yetkileri ver
    await queryRunner.query(`
      INSERT INTO user_permissions (userId, module, "canView", "canCreate", "canEdit", "canDelete")
      SELECT 
        u.id,
        m.module,
        true,
        CASE WHEN m.module IN ('events', 'reservations', 'customers', 'invitations') THEN true ELSE false END,
        CASE WHEN m.module IN ('events', 'reservations', 'customers') THEN true ELSE false END,
        false
      FROM users u
      CROSS JOIN (
        SELECT unnest(ARRAY[
          'events', 'reservations', 'check_in', 'staff', 
          'customers', 'venues', 'invitations', 'notifications'
        ]::text[]) as module
      ) m
      WHERE u.role = 'organizer';
    `);

    // Controller kullanıcılarına sadece check-in yetkisi ver
    await queryRunner.query(`
      INSERT INTO user_permissions (userId, module, "canView", "canCreate", "canEdit", "canDelete")
      SELECT 
        u.id,
        'check_in',
        true,
        true,
        false,
        false
      FROM users u
      WHERE u.role = 'controller';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("user_permissions");
  }
}
