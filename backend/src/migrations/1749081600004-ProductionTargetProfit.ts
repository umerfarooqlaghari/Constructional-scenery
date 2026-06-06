import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds target_profit_pct to productions — the target profit percentage
 * Warren sets at the start of each On a Price production.
 * Used by the Type 1 cost report to calculate available spend remaining.
 */
export class ProductionTargetProfit1749081600004 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE productions
        ADD COLUMN IF NOT EXISTS target_profit_pct DECIMAL(5,2)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE productions
        DROP COLUMN IF EXISTS target_profit_pct
    `);
  }
}
