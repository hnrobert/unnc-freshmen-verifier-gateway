/* eslint-disable class-methods-use-this */
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserRole1784284851394 implements MigrationInterface {
    name = 'AddUserRole1784284851394'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "uq_users_email"`);
        await queryRunner.query(`CREATE TABLE "temporary_users" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" text NOT NULL, "password_hash" text NOT NULL, "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "trusted_until" datetime, "role" text NOT NULL DEFAULT ('admin'))`);
        await queryRunner.query(`INSERT INTO "temporary_users"("id", "email", "password_hash", "created_at", "trusted_until") SELECT "id", "email", "password_hash", "created_at", "trusted_until" FROM "users"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`ALTER TABLE "temporary_users" RENAME TO "users"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "uq_users_email"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME TO "temporary_users"`);
        await queryRunner.query(`CREATE TABLE "users" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" text NOT NULL, "password_hash" text NOT NULL, "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "trusted_until" datetime)`);
        await queryRunner.query(`INSERT INTO "users"("id", "email", "password_hash", "created_at", "trusted_until") SELECT "id", "email", "password_hash", "created_at", "trusted_until" FROM "temporary_users"`);
        await queryRunner.query(`DROP TABLE "temporary_users"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email") `);
    }

}
