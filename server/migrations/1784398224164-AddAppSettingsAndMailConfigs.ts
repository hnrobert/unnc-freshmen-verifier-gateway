/* eslint-disable class-methods-use-this */
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAppSettingsAndMailConfigs1784398224164 implements MigrationInterface {
  name = 'AddAppSettingsAndMailConfigs1784398224164'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "app_settings" ("key" text PRIMARY KEY NOT NULL, "value" text NOT NULL DEFAULT ('{}'))`,
    )
    await queryRunner.query(
      `CREATE TABLE "mail_configs" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "user_id" integer NOT NULL, "smtp_server" text NOT NULL DEFAULT (''), "smtp_port" integer NOT NULL DEFAULT (587), "use_ssl" boolean NOT NULL DEFAULT (0), "use_tls" boolean NOT NULL DEFAULT (1), "use_password" boolean NOT NULL DEFAULT (1), "sender_email" text NOT NULL DEFAULT (''), "sender_email_display" text NOT NULL DEFAULT (''), "sender_domain" text NOT NULL DEFAULT (''), "sender_password" text NOT NULL DEFAULT (''), "max_len_recipient_email" integer NOT NULL DEFAULT (64), "max_len_subject" integer NOT NULL DEFAULT (255), "max_len_body" integer NOT NULL DEFAULT (50000), "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updated_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_mail_configs_user" ON "mail_configs" ("user_id") `,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_mail_configs_user"`)
    await queryRunner.query(`DROP TABLE "mail_configs"`)
    await queryRunner.query(`DROP TABLE "app_settings"`)
  }
}
