import { MigrationInterface, QueryRunner } from 'typeorm';

export class BudgetLinesExtendedFields1781700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cost_plus_budget_lines
        ADD COLUMN IF NOT EXISTS bectu_rate       NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS agreed_rate      NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS line_margin_rate NUMERIC(5,4),
        ADD COLUMN IF NOT EXISTS is_above_line    BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS set_id           UUID REFERENCES sets(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS notes            TEXT,
        ADD COLUMN IF NOT EXISTS line_type        VARCHAR(20) NOT NULL DEFAULT 'set'
    `);
    await queryRunner.query(`
      ALTER TABLE cost_plus_budgets
        ADD COLUMN IF NOT EXISTS notes TEXT
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cost_plus_budget_lines
        DROP COLUMN IF EXISTS bectu_rate,
        DROP COLUMN IF EXISTS agreed_rate,
        DROP COLUMN IF EXISTS line_margin_rate,
        DROP COLUMN IF EXISTS is_above_line,
        DROP COLUMN IF EXISTS set_id,
        DROP COLUMN IF EXISTS notes,
        DROP COLUMN IF EXISTS line_type
    `);
    await queryRunner.query(`
      ALTER TABLE cost_plus_budgets
        DROP COLUMN IF EXISTS notes
    `);
  }
}
