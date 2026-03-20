import { MigrationInterface, QueryRunner } from "typeorm";

export class AddQrCodeAndInvitationToggles1767000000000 implements MigrationInterface {
  name = "AddQrCodeAndInvitationToggles1767000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "system_settings" ADD "qrCodeSystemEnabled" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "system_settings" ADD "invitationSystemEnabled" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "system_settings" DROP COLUMN "invitationSystemEnabled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "system_settings" DROP COLUMN "qrCodeSystemEnabled"`,
    );
  }
}
