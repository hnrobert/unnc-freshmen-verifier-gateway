/* eslint-disable class-methods-use-this */
import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1784089805639 implements MigrationInterface {
    name = 'Init1784089805639'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" text NOT NULL, "password_hash" text NOT NULL, "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "sessions" ("id" text PRIMARY KEY NOT NULL, "user_id" integer NOT NULL, "expires_at" datetime NOT NULL, "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`);
        await queryRunner.query(`CREATE TABLE "organizations" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "owner_id" integer NOT NULL, "slug" text NOT NULL, "name" text NOT NULL, "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_organizations_slug" ON "organizations" ("slug") `);
        await queryRunner.query(`CREATE TABLE "org_settings" ("org_id" integer PRIMARY KEY NOT NULL, "config" text NOT NULL, "updated_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`);
        await queryRunner.query(`CREATE TABLE "org_images" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "org_id" integer NOT NULL, "key" text NOT NULL, "mime" text NOT NULL, "base64" text NOT NULL, "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_org_images_org_key" ON "org_images" ("org_id", "key") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "uq_org_images_org_key"`);
        await queryRunner.query(`DROP TABLE "org_images"`);
        await queryRunner.query(`DROP TABLE "org_settings"`);
        await queryRunner.query(`DROP INDEX "uq_organizations_slug"`);
        await queryRunner.query(`DROP TABLE "organizations"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP INDEX "uq_users_email"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
