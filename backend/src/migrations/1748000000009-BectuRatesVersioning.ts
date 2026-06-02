import { MigrationInterface, QueryRunner } from 'typeorm';

export class BectuRatesVersioning1748000000009 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Add versioning and rate_type columns
    await queryRunner.query(`
      ALTER TABLE bectu_rates
        ADD COLUMN IF NOT EXISTS effective_from DATE,
        ADD COLUMN IF NOT EXISTS effective_to   DATE,
        ADD COLUMN IF NOT EXISTS rate_type      TEXT DEFAULT 'bectu'
    `);

    // Backfill effective_from from rate_year (2026/27 → 2026-04-07)
    await queryRunner.query(`
      UPDATE bectu_rates
      SET effective_from = CASE
        WHEN rate_year = '2026/27' THEN '2026-04-07'::date
        ELSE '2026-04-07'::date
      END
      WHERE effective_from IS NULL
    `);

    // Mark Non-BECTU trade rows
    await queryRunner.query(`
      UPDATE bectu_rates SET rate_type = 'non_bectu'
      WHERE trade = 'Non-BECTU'
    `);

    // Add unique index on (trade, rank, effective_from)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS bectu_rates_trade_rank_effective
      ON bectu_rates(trade, rank, effective_from)
    `);

    // Index for current-only queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bectu_rates_active
      ON bectu_rates(effective_to) WHERE effective_to IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bectu_rates_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS bectu_rates_trade_rank_effective`);
    await queryRunner.query(`
      ALTER TABLE bectu_rates
        DROP COLUMN IF EXISTS effective_from,
        DROP COLUMN IF EXISTS effective_to,
        DROP COLUMN IF EXISTS rate_type
    `);
  }
}
