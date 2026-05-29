import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 3NF Normalization: Replace cost_plus_budgets.budget_lines JSONB with
 * a proper cost_plus_budget_lines table.
 *
 * Existing JSONB data is migrated row-by-row before the column is dropped.
 */
export class NormalizeBudgetLines1748000000001 implements MigrationInterface {
  name = 'NormalizeBudgetLines1748000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the normalised budget lines table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cost_plus_budget_lines (
        id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        budget_id    UUID NOT NULL REFERENCES cost_plus_budgets(id) ON DELETE CASCADE,
        account_code TEXT,
        description  TEXT NOT NULL,
        weekly_cost  DECIMAL(12,2) DEFAULT 0,
        weeks        INTEGER DEFAULT 0,
        total        DECIMAL(14,2) DEFAULT 0,
        sort_order   INTEGER DEFAULT 0,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_budget_lines_budget_id ON cost_plus_budget_lines(budget_id)`);

    // 2. Migrate existing JSONB data to the new table
    const budgets: Array<{ id: string; budget_lines: string | null }> = await queryRunner.query(
      `SELECT id, budget_lines FROM cost_plus_budgets WHERE budget_lines IS NOT NULL AND budget_lines != 'null'::jsonb`
    );

    for (const budget of budgets) {
      let lines: Array<{
        account_code?: string;
        description?: string;
        weekly_cost?: number;
        weeks?: number;
        total?: number;
      }> = [];

      try {
        lines = typeof budget.budget_lines === 'string'
          ? JSON.parse(budget.budget_lines)
          : (budget.budget_lines as any);
      } catch {
        continue;
      }

      if (!Array.isArray(lines) || lines.length === 0) continue;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const weekly = parseFloat(String(line.weekly_cost ?? 0));
        const weeks  = parseInt(String(line.weeks ?? 0), 10);
        const total  = parseFloat(String(line.total ?? weekly * weeks));

        await queryRunner.query(
          `INSERT INTO cost_plus_budget_lines
             (budget_id, account_code, description, weekly_cost, weeks, total, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [budget.id, line.account_code ?? null, line.description ?? '', weekly, weeks, total, i]
        );
      }
    }

    // 3. Drop the JSONB column now that data is migrated
    await queryRunner.query(`ALTER TABLE cost_plus_budgets DROP COLUMN IF EXISTS budget_lines`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore JSONB column and re-aggregate data back into it
    await queryRunner.query(`ALTER TABLE cost_plus_budgets ADD COLUMN IF NOT EXISTS budget_lines JSONB`);

    const budgets: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM cost_plus_budgets`
    );

    for (const budget of budgets) {
      const lines = await queryRunner.query(
        `SELECT account_code, description, weekly_cost, weeks, total
         FROM cost_plus_budget_lines WHERE budget_id = $1 ORDER BY sort_order`,
        [budget.id]
      );
      await queryRunner.query(
        `UPDATE cost_plus_budgets SET budget_lines = $1::jsonb WHERE id = $2`,
        [JSON.stringify(lines), budget.id]
      );
    }

    await queryRunner.query(`DROP TABLE IF EXISTS cost_plus_budget_lines CASCADE`);
  }
}
