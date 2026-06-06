import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gaps 3, 6, 9 schema changes:
 *
 * Gap 3  — timesheets.rank_override / rate_override
 *   Stores the per-timesheet rank and rate selected by the user.
 *   Does not affect the crew member's Crew Database record.
 *
 * Gap 6  — timesheet_entries meal allowance amounts
 *   Stores the £ amount selected for each meal (blank / £5 / £10).
 *   Replaces the boolean flag approach for amount-aware meal tracking.
 *
 * Gap 9  — app_settings table
 *   Key-value store for admin-configurable settings such as
 *   handover_alert_days. Seeded with defaults.
 */
export class RankOverrideMealAllowanceAndSettings1749254400004 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // ── Gap 3: rank + rate override on timesheets ─────────────────────────────
    await queryRunner.query(`
      ALTER TABLE timesheets
        ADD COLUMN IF NOT EXISTS rank_override TEXT,
        ADD COLUMN IF NOT EXISTS rate_override DECIMAL(10,2)
    `);

    // ── Gap 6: per-meal allowance amounts on timesheet_entries ────────────────
    await queryRunner.query(`
      ALTER TABLE timesheet_entries
        ADD COLUMN IF NOT EXISTS meal_allowance_breakfast DECIMAL(6,2),
        ADD COLUMN IF NOT EXISTS meal_allowance_lunch     DECIMAL(6,2),
        ADD COLUMN IF NOT EXISTS meal_allowance_supper    DECIMAL(6,2)
    `);

    // ── Gap 9: app_settings key-value store ───────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key        TEXT        PRIMARY KEY,
        value      JSONB       NOT NULL,
        updated_by UUID        REFERENCES users(id),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Seed default handover alert thresholds (days before handover)
    await queryRunner.query(`
      INSERT INTO app_settings (key, value)
      VALUES ('handover_alert_days', '[14, 7]'::jsonb)
      ON CONFLICT (key) DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS app_settings`);
    await queryRunner.query(`ALTER TABLE timesheet_entries DROP COLUMN IF EXISTS meal_allowance_supper`);
    await queryRunner.query(`ALTER TABLE timesheet_entries DROP COLUMN IF EXISTS meal_allowance_lunch`);
    await queryRunner.query(`ALTER TABLE timesheet_entries DROP COLUMN IF EXISTS meal_allowance_breakfast`);
    await queryRunner.query(`ALTER TABLE timesheets DROP COLUMN IF EXISTS rate_override`);
    await queryRunner.query(`ALTER TABLE timesheets DROP COLUMN IF EXISTS rank_override`);
  }
}
