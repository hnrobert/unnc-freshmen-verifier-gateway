import { type MigrationInterface, type QueryRunner } from 'typeorm'

/** Share-poster presentation settings, split from the page's large JSON config. */
export class AddPageShareSettings1788000000000 implements MigrationInterface {
  name = 'AddPageShareSettings1788000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "page_share_settings" (' +
        '"page_id" integer PRIMARY KEY NOT NULL, ' +
        '"title" text NOT NULL DEFAULT (\'\'), ' +
        '"font_size" integer NOT NULL DEFAULT (60), ' +
        '"width" integer NOT NULL DEFAULT (480), ' +
        '"height" integer NOT NULL DEFAULT (680), ' +
        '"border_width" integer NOT NULL DEFAULT (0), ' +
        '"border_radius" integer NOT NULL DEFAULT (12), ' +
        '"updated_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), ' +
        'CONSTRAINT "fk_page_share_settings_page" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE CASCADE)',
    )
    // Preserve titles saved by the earlier JSON-based implementation.
    await queryRunner.query(
      'INSERT INTO "page_share_settings" ("page_id", "title") ' +
        'SELECT "page_id", COALESCE(CASE WHEN json_valid("config") THEN json_extract("config", \'$.share.posterTitle\') END, \'\') ' +
        'FROM "page_settings"',
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "page_share_settings"')
  }
}
