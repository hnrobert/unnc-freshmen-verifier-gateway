/* eslint-disable class-methods-use-this */
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPasskeys1784390766498 implements MigrationInterface {
    name = 'AddPasskeys1784390766498'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "passkeys" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "credential_id" text NOT NULL, "user_id" integer NOT NULL, "public_key" blob NOT NULL, "counter" integer NOT NULL DEFAULT (0), "transports" text, "device_type" text, "backed_up" boolean NOT NULL DEFAULT (0), "nickname" text, "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`);
        await queryRunner.query(`CREATE INDEX "idx_passkeys_user" ON "passkeys" ("user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_passkeys_credential_id" ON "passkeys" ("credential_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "uq_passkeys_credential_id"`);
        await queryRunner.query(`DROP INDEX "idx_passkeys_user"`);
        await queryRunner.query(`DROP TABLE "passkeys"`);
    }

}
