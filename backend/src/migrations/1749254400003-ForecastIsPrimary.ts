import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Production linking & forecast vs actual variance (KAN-50).
 *
 * forecasts.is_primary — marks the single forecast used for Dashboard variance display.
 * Only one forecast per production can be primary at a time; enforced by a partial unique index.
 */
export class ForecastIsPrimary1749254400003 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE forecasts
        ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false
    `);
    // Only one active primary per production (NULL production_id excluded)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_forecasts_primary_per_production
        ON forecasts (production_id)
        WHERE is_primary = true
          AND production_id IS NOT NULL
          AND deleted_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_forecasts_primary_per_production`);
    await queryRunner.query(`ALTER TABLE forecasts DROP COLUMN IF EXISTS is_primary`);
  }
}
