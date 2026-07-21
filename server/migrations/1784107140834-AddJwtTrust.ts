/* eslint-disable class-methods-use-this */
import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddJwtTrust1784107140834 implements MigrationInterface {
  name = 'AddJwtTrust1784107140834'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "verifications" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "user_id" integer NOT NULL, "org_slug" text NOT NULL, "name" text NOT NULL, "id_number" text NOT NULL, "verified_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
    )
    await queryRunner.query(`CREATE INDEX "idx_verifications_user" ON "verifications" ("user_id") `)
    await queryRunner.query(`DROP INDEX "uq_users_email"`)
    await queryRunner.query(
      `CREATE TABLE "temporary_users" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" text NOT NULL, "password_hash" text NOT NULL, "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "trusted_until" datetime)`,
    )
    await queryRunner.query(
      `INSERT INTO "temporary_users"("id", "email", "password_hash", "created_at") SELECT "id", "email", "password_hash", "created_at" FROM "users"`,
    )
    await queryRunner.query(`DROP TABLE "users"`)
    await queryRunner.query(`ALTER TABLE "temporary_users" RENAME TO "users"`)
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email") `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_users_email"`)
    await queryRunner.query(`ALTER TABLE "users" RENAME TO "temporary_users"`)
    await queryRunner.query(
      `CREATE TABLE "users" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" text NOT NULL, "password_hash" text NOT NULL, "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
    )
    await queryRunner.query(
      `INSERT INTO "users"("id", "email", "password_hash", "created_at") SELECT "id", "email", "password_hash", "created_at" FROM "temporary_users"`,
    )
    await queryRunner.query(`DROP TABLE "temporary_users"`)
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email") `)
    await queryRunner.query(`DROP INDEX "idx_verifications_user"`)
    await queryRunner.query(`DROP TABLE "verifications"`)
  }
}
