import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureAllModuleColumns1786900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Supplier catalogue columns
    await queryRunner.query(`
      ALTER TABLE supplier_catalogue
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
    `);

    // 2. Timesheet entries columns
    await queryRunner.query(`
      ALTER TABLE timesheet_entries
        ADD COLUMN IF NOT EXISTS mileage                  NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS per_diem                 NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS ad_hoc_reimbursement     NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS meal_allowance_breakfast NUMERIC DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS meal_allowance_lunch     NUMERIC DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS meal_allowance_supper    NUMERIC DEFAULT NULL
    `);

    // 3. Timesheets columns
    await queryRunner.query(`
      ALTER TABLE timesheets
        ADD COLUMN IF NOT EXISTS rank_override TEXT,
        ADD COLUMN IF NOT EXISTS rate_override DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS amended_at    TIMESTAMPTZ
    `);

    // 4. BECTU rates columns
    await queryRunner.query(`
      ALTER TABLE bectu_rates
        ADD COLUMN IF NOT EXISTS effective_from DATE,
        ADD COLUMN IF NOT EXISTS effective_to   DATE,
        ADD COLUMN IF NOT EXISTS rate_type      TEXT DEFAULT 'bectu'
    `);

    // Backfill effective_from if null
    await queryRunner.query(`
      UPDATE bectu_rates
      SET effective_from = '2026-04-07'::date
      WHERE effective_from IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bectu_rates
        DROP COLUMN IF EXISTS rate_type,
        DROP COLUMN IF EXISTS effective_to,
        DROP COLUMN IF EXISTS effective_from
    `);
    await queryRunner.query(`
      ALTER TABLE timesheets
        DROP COLUMN IF EXISTS amended_at,
        DROP COLUMN IF EXISTS rate_override,
        DROP COLUMN IF EXISTS rank_override
    `);
    await queryRunner.query(`
      ALTER TABLE timesheet_entries
        DROP COLUMN IF EXISTS meal_allowance_supper,
        DROP COLUMN IF EXISTS meal_allowance_lunch,
        DROP COLUMN IF EXISTS meal_allowance_breakfast,
        DROP COLUMN IF EXISTS ad_hoc_reimbursement,
        DROP COLUMN IF EXISTS per_diem,
        DROP COLUMN IF EXISTS mileage
    `);
    await queryRunner.query(`
      ALTER TABLE supplier_catalogue
        DROP COLUMN IF EXISTS deleted_at
    `);
  }
}
