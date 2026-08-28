import { type MigrationInterface, type QueryRunner } from 'typeorm'

export class AddPagePosterSettings1787780528885 implements MigrationInterface {
  name = 'AddPagePosterSettings1787780528885'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "page_poster_settings" ("page_id" integer PRIMARY KEY NOT NULL, "title" text NOT NULL DEFAULT (\'\'), "theme" text NOT NULL DEFAULT (\'page\'), "font_size" integer NOT NULL DEFAULT (60), "width" integer NOT NULL DEFAULT (1080), "height" integer NOT NULL DEFAULT (1440), "border" integer NOT NULL DEFAULT (0), "border_radius" integer NOT NULL DEFAULT (28), "updated_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))',
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "page_poster_settings"')
  }
}
