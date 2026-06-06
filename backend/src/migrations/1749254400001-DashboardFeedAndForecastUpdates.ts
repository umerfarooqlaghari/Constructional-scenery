import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema additions for:
 *  1. Dashboard feed & production archiving (KAN-45)
 *     - productions.agreed_price        — budget reference for On a Price contracts
 *     - cost_report_weekly_pl uplift cols — luton_uplift, box_rental_uplift for Warren's P&L
 *  2. Labour & materials forecaster with scenario saving
 *     - forecasts.deleted_at            — soft-delete (never hard-delete a scenario)
 *     - forecast_labour_items.daily_rate / ot_rate — store BECTU rates at time of save
 *     - forecast_materials_items.quantity           — row quantity for line-total calc
 */
export class DashboardFeedAndForecastUpdates1749254400001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. On a Price budget reference ────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE productions
        ADD COLUMN IF NOT EXISTS agreed_price DECIMAL(14,2)
    `);

    // ── 2. Warren's Weekly P&L uplift columns ─────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE cost_report_weekly_pl
        ADD COLUMN IF NOT EXISTS luton_uplift      DECIMAL(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS box_rental_uplift DECIMAL(12,2) NOT NULL DEFAULT 0
    `);

    // ── 3. Forecast soft-delete ───────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE forecasts
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_forecasts_deleted
        ON forecasts (deleted_at)
    `);

    // ── 4. Store BECTU daily_rate + ot_rate on each labour item ───────────────
    await queryRunner.query(`
      ALTER TABLE forecast_labour_items
        ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS ot_rate    DECIMAL(10,2)
    `);

    // ── 5. Quantity on materials items for line-total calculation ─────────────
    await queryRunner.query(`
      ALTER TABLE forecast_materials_items
        ADD COLUMN IF NOT EXISTS quantity DECIMAL(10,3) NOT NULL DEFAULT 1
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE forecast_materials_items DROP COLUMN IF EXISTS quantity`);
    await queryRunner.query(`ALTER TABLE forecast_labour_items    DROP COLUMN IF EXISTS ot_rate`);
    await queryRunner.query(`ALTER TABLE forecast_labour_items    DROP COLUMN IF EXISTS daily_rate`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_forecasts_deleted`);
    await queryRunner.query(`ALTER TABLE forecasts                DROP COLUMN IF EXISTS deleted_at`);
    await queryRunner.query(`ALTER TABLE cost_report_weekly_pl    DROP COLUMN IF EXISTS box_rental_uplift`);
    await queryRunner.query(`ALTER TABLE cost_report_weekly_pl    DROP COLUMN IF EXISTS luton_uplift`);
    await queryRunner.query(`ALTER TABLE productions              DROP COLUMN IF EXISTS agreed_price`);
  }
}
