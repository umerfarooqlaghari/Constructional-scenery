import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Supplier & materials price catalogue + Percentometer estimator upgrades.
 *
 * supplier_catalogue:
 *   - Add deleted_at (soft-delete replaces is_active for catalogue hide/show)
 *
 * percentometer_ratios:
 *   - Add effective_from / effective_to for versioning (same pattern as bectu_rates)
 *   - Drop old UNIQUE on cost_type; replace with partial unique (cost_type WHERE effective_to IS NULL)
 *
 * percentometer_actuals:
 *   - One row per cost_type per production, written on archive
 *
 * forecasts:
 *   - percentometer_snapshot JSONB — stores the full breakdown at save time
 */
export class SupplierCatalogueAndPercentometerUpgrades1749254400002 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Supplier catalogue soft-delete ─────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE supplier_catalogue
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_supplier_catalogue_deleted
        ON supplier_catalogue (deleted_at)
    `);

    // ── 2. Percentometer ratios — versioning ──────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE percentometer_ratios
        ADD COLUMN IF NOT EXISTS effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
        ADD COLUMN IF NOT EXISTS effective_to   DATE
    `);
    // Drop the old UNIQUE constraint on cost_type (blocks multiple versions)
    await queryRunner.query(`
      ALTER TABLE percentometer_ratios
        DROP CONSTRAINT IF EXISTS percentometer_ratios_cost_type_key
    `);
    // Partial unique: only one active row per cost_type (where effective_to IS NULL)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_percentometer_ratios_active_cost_type
        ON percentometer_ratios (cost_type)
        WHERE effective_to IS NULL
    `);

    // ── 3. Percentometer actuals — written on production archive ──────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS percentometer_actuals (
        id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        production_id     UUID        NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
        status            TEXT        NOT NULL DEFAULT 'processing'
                                      CHECK (status IN ('processing', 'complete', 'failed')),
        cost_type         TEXT,
        actual_amount     DECIMAL(14,2),
        actual_percentage DECIMAL(6,3),
        grand_total       DECIMAL(14,2),
        error_message     TEXT,
        computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_percentometer_actuals_production
        ON percentometer_actuals (production_id)
    `);

    // ── 4. Forecast percentometer snapshot ────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE forecasts
        ADD COLUMN IF NOT EXISTS percentometer_snapshot JSONB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE forecasts DROP COLUMN IF EXISTS percentometer_snapshot`);
    await queryRunner.query(`DROP TABLE IF EXISTS percentometer_actuals`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_percentometer_ratios_active_cost_type`);
    await queryRunner.query(`
      ALTER TABLE percentometer_ratios
        DROP COLUMN IF EXISTS effective_to,
        DROP COLUMN IF EXISTS effective_from
    `);
    await queryRunner.query(`
      ALTER TABLE percentometer_ratios
        ADD CONSTRAINT percentometer_ratios_cost_type_key UNIQUE (cost_type)
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_supplier_catalogue_deleted`);
    await queryRunner.query(`ALTER TABLE supplier_catalogue DROP COLUMN IF EXISTS deleted_at`);
  }
}
