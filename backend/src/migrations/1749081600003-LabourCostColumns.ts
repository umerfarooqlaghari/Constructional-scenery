import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds labour-specific columns to cost_report_entries so that one row per
 * finalised timesheet can be recorded when a pay run is processed.
 *
 * Supplier entries leave these columns NULL; labour entries populate them and
 * leave supplier_name / po_number / payment_method NULL.
 */
export class LabourCostColumns1749081600003 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Crew & labour metadata
    await queryRunner.query(`
      ALTER TABLE cost_report_entries
        ADD COLUMN IF NOT EXISTS crew_member_id   UUID    REFERENCES crew_members(id),
        ADD COLUMN IF NOT EXISTS trade             TEXT,
        ADD COLUMN IF NOT EXISTS rank              TEXT,
        ADD COLUMN IF NOT EXISTS week_ending_date  DATE,
        ADD COLUMN IF NOT EXISTS total_days        SMALLINT,
        ADD COLUMN IF NOT EXISTS ot_hours          DECIMAL(6,2),
        ADD COLUMN IF NOT EXISTS daily_rate        DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS ot_rate           DECIMAL(10,2)
    `);

    // Individual working-day flags (Mon–Sun)
    await queryRunner.query(`
      ALTER TABLE cost_report_entries
        ADD COLUMN IF NOT EXISTS day_monday    BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS day_tuesday   BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS day_wednesday BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS day_thursday  BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS day_friday    BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS day_saturday  BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS day_sunday    BOOLEAN NOT NULL DEFAULT false
    `);

    // Index on week_ending_date for labour cost queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cost_report_entries_week
        ON cost_report_entries (week_ending_date)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cost_report_entries_week`);

    await queryRunner.query(`
      ALTER TABLE cost_report_entries
        DROP COLUMN IF EXISTS crew_member_id,
        DROP COLUMN IF EXISTS trade,
        DROP COLUMN IF EXISTS rank,
        DROP COLUMN IF EXISTS week_ending_date,
        DROP COLUMN IF EXISTS total_days,
        DROP COLUMN IF EXISTS ot_hours,
        DROP COLUMN IF EXISTS daily_rate,
        DROP COLUMN IF EXISTS ot_rate,
        DROP COLUMN IF EXISTS day_monday,
        DROP COLUMN IF EXISTS day_tuesday,
        DROP COLUMN IF EXISTS day_wednesday,
        DROP COLUMN IF EXISTS day_thursday,
        DROP COLUMN IF EXISTS day_friday,
        DROP COLUMN IF EXISTS day_saturday,
        DROP COLUMN IF EXISTS day_sunday
    `);
  }
}
