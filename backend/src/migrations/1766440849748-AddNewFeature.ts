import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNewFeature1766440849748 implements MigrationInterface {
    name = 'AddNewFeature1766440849748'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "staff_performance_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "staffId" character varying NOT NULL, "eventId" character varying NOT NULL, "actionType" character varying NOT NULL, "responseTimeSeconds" integer, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d504eec899ecaad558fabc68cec" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "staff_performance_logs"`);
    }

}
