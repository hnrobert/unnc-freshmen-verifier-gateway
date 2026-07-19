/* eslint-disable class-methods-use-this */
import type { MigrationInterface, QueryRunner } from 'typeorm'

export class OrgSharingStats1784395098597 implements MigrationInterface {
  name = 'OrgSharingStats1784395098597'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Org sharing (org_members) ---
    await queryRunner.query(
      `CREATE TABLE "org_members" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "org_id" integer NOT NULL, "user_id" integer, "invited_email" text NOT NULL, "invite_token" text, "role" text NOT NULL, "status" text NOT NULL DEFAULT ('pending'), "invited_by" integer NOT NULL, "expires_at" datetime, "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "accepted_at" datetime)`,
    )
    await queryRunner.query(`CREATE INDEX "idx_org_members_org" ON "org_members" ("org_id") `)
    await queryRunner.query(`CREATE INDEX "idx_org_members_user" ON "org_members" ("user_id") `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_org_members_org_email" ON "org_members" ("org_id", "invited_email") `,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_org_members_token" ON "org_members" ("invite_token") `,
    )

    // --- Org statistics (raw events + daily rollup) ---
    await queryRunner.query(
      `CREATE TABLE "org_events" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "org_id" integer NOT NULL, "type" text NOT NULL, "outcome" text, "mode" text, "name" text, "id_hash" text, "ip_hash" text, "locale" text, "country" text, "device" text, "browser" text, "os" text, "referer" text, "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_org_events_org_time" ON "org_events" ("org_id", "created_at") `,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_org_events_type" ON "org_events" ("org_id", "type", "created_at") `,
    )
    await queryRunner.query(
      `CREATE TABLE "org_daily_stats" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "org_id" integer NOT NULL, "day" text NOT NULL, "metric" text NOT NULL, "count" integer NOT NULL DEFAULT (0))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_org_daily_stats_org_day" ON "org_daily_stats" ("org_id", "day") `,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_org_daily_stats_day_metric" ON "org_daily_stats" ("org_id", "day", "metric") `,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_org_daily_stats_day_metric"`)
    await queryRunner.query(`DROP INDEX "idx_org_daily_stats_org_day"`)
    await queryRunner.query(`DROP TABLE "org_daily_stats"`)
    await queryRunner.query(`DROP INDEX "idx_org_events_type"`)
    await queryRunner.query(`DROP INDEX "idx_org_events_org_time"`)
    await queryRunner.query(`DROP TABLE "org_events"`)
    await queryRunner.query(`DROP INDEX "uq_org_members_token"`)
    await queryRunner.query(`DROP INDEX "uq_org_members_org_email"`)
    await queryRunner.query(`DROP INDEX "idx_org_members_user"`)
    await queryRunner.query(`DROP INDEX "idx_org_members_org"`)
    await queryRunner.query(`DROP TABLE "org_members"`)
  }
}
