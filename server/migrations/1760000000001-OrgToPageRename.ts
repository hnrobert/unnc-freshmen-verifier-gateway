import { type MigrationInterface, type QueryRunner } from 'typeorm'

/**
 * Rename the physical schema from the org_* vocabulary to page_*: 10 tables,
 * their org_id columns → page_id, users.org_limit → page_limit, and the
 * persisted `app_settings` limits key. Index/constraint NAMES are intentionally
 * left with their old spelling (they are labels, not identifiers — renaming
 * them in SQLite requires drop/recreate for no benefit; see
 * docs/DATABASE-NAMING.md).
 *
 * Every statement is existence-guarded so the migration is a no-op on databases
 * that were created fresh by Init (they never had org_* names). Reverse for
 * `down()`.
 */
export class OrgToPageRename1760000000001 implements MigrationInterface {
  name = 'OrgToPageRename1760000000001'

  private async tableExists(qr: QueryRunner, name: string): Promise<boolean> {
    const row = await qr.query("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [
      name,
    ])
    return Array.isArray(row) ? row.length > 0 : !!row
  }

  private async columnExists(qr: QueryRunner, table: string, column: string): Promise<boolean> {
    const rows = (await qr.query(`PRAGMA table_info(${table})`)) as { name: string }[]
    return Array.isArray(rows) && rows.some((r) => r.name === column)
  }

  public async up(qr: QueryRunner): Promise<void> {
    const tableRenames: [string, string][] = [
      ['organizations', 'pages'],
      ['org_settings', 'page_settings'],
      ['org_images', 'page_images'],
      ['org_members', 'page_members'],
      ['org_events', 'page_events'],
      ['org_daily_stats', 'page_daily_stats'],
      ['org_reminder_sents', 'page_reminder_sents'],
      ['org_redirects', 'page_redirects'],
      ['org_verified_identities', 'page_verified_identities'],
      ['user_org_notification_prefs', 'user_page_notification_prefs'],
    ]
    for (const [from, to] of tableRenames) {
      if (await this.tableExists(qr, from)) await qr.query(`ALTER TABLE ${from} RENAME TO ${to}`)
    }

    // org_id → page_id on every child table (already under its new name).
    const orgIdTables = [
      'page_settings',
      'page_images',
      'page_members',
      'page_events',
      'page_daily_stats',
      'page_reminder_sents',
      'page_redirects',
      'page_verified_identities',
      'user_page_notification_prefs',
      'audit_events',
    ]
    for (const t of orgIdTables) {
      if ((await this.tableExists(qr, t)) && (await this.columnExists(qr, t, 'org_id'))) {
        await qr.query(`ALTER TABLE ${t} RENAME COLUMN org_id TO page_id`)
      }
    }

    if (await this.columnExists(qr, 'users', 'org_limit')) {
      await qr.query(`ALTER TABLE users RENAME COLUMN org_limit TO page_limit`)
    }

    // Persisted app_settings key (server/utils/limits.ts SETTING_KEY).
    await qr.query(
      `UPDATE app_settings SET key = 'limits.adminPageLimit' WHERE key = 'limits.adminOrgLimit'`,
    )
  }

  public async down(qr: QueryRunner): Promise<void> {
    const tableRenames: [string, string][] = [
      ['pages', 'organizations'],
      ['page_settings', 'org_settings'],
      ['page_images', 'org_images'],
      ['page_members', 'org_members'],
      ['page_events', 'org_events'],
      ['page_daily_stats', 'org_daily_stats'],
      ['page_reminder_sents', 'org_reminder_sents'],
      ['page_redirects', 'org_redirects'],
      ['page_verified_identities', 'org_verified_identities'],
      ['user_page_notification_prefs', 'user_org_notification_prefs'],
    ]

    if (await this.columnExists(qr, 'users', 'page_limit')) {
      await qr.query(`ALTER TABLE users RENAME COLUMN page_limit TO org_limit`)
    }
    await qr.query(
      `UPDATE app_settings SET key = 'limits.adminOrgLimit' WHERE key = 'limits.adminPageLimit'`,
    )

    const pageIdTables = [
      'page_settings',
      'page_images',
      'page_members',
      'page_events',
      'page_daily_stats',
      'page_reminder_sents',
      'page_redirects',
      'page_verified_identities',
      'user_page_notification_prefs',
      'audit_events',
    ]
    for (const t of pageIdTables) {
      if ((await this.tableExists(qr, t)) && (await this.columnExists(qr, t, 'page_id'))) {
        await qr.query(`ALTER TABLE ${t} RENAME COLUMN page_id TO org_id`)
      }
    }
    for (const [from, to] of tableRenames) {
      if (await this.tableExists(qr, from)) await qr.query(`ALTER TABLE ${from} RENAME TO ${to}`)
    }
  }
}
