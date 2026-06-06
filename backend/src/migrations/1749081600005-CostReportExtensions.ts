import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds four supporting tables for the Type 2 (Cost Plus) cost report:
 *
 * cost_report_po_billing        — stores the manually-entered CS Invoice Number
 *                                 and Amount Invoiced per approved PO
 * cost_report_omitted_entries   — marks a cost_report_entry as "omit this week"
 *                                 so it is excluded from that week's recharge submission
 * cost_report_margins_reference — the static reference text listing what the
 *                                 margin covers; editable by MD only
 * cost_report_weekly_pl         — stores manually-entered Warren's Salary per week
 *                                 so the Weekly P&L tab can auto-calculate profit
 */
export class CostReportExtensions1749081600005 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // ── PO billing editable fields ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cost_report_po_billing (
        id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        production_id     UUID        NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
        source_id         UUID        NOT NULL,
        cs_invoice_number TEXT,
        amount_invoiced   DECIMAL(12,2) NOT NULL DEFAULT 0,
        notes             TEXT,
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by        UUID        REFERENCES users(id),
        UNIQUE (production_id, source_id)
      )
    `);

    // ── Omitted POs & labour charges ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cost_report_omitted_entries (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        production_id    UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
        entry_id         UUID NOT NULL,
        week_ending_date DATE NOT NULL,
        omit_reason      TEXT,
        omitted_by       UUID REFERENCES users(id),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (entry_id, week_ending_date)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cr_omitted_production
        ON cost_report_omitted_entries (production_id, week_ending_date)
    `);

    // ── Margins reference sheet (one row per production) ───────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cost_report_margins_reference (
        production_id UUID        PRIMARY KEY REFERENCES productions(id) ON DELETE CASCADE,
        items         TEXT[]      NOT NULL DEFAULT '{}',
        notes         TEXT,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by    UUID        REFERENCES users(id)
      )
    `);

    // ── Warren's Weekly P&L manual entries ────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cost_report_weekly_pl (
        id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        production_id    UUID        NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
        week_ending_date DATE        NOT NULL,
        warrens_salary   DECIMAL(12,2) NOT NULL DEFAULT 0,
        notes            TEXT,
        UNIQUE (production_id, week_ending_date)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS cost_report_weekly_pl`);
    await queryRunner.query(`DROP TABLE IF EXISTS cost_report_margins_reference`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cr_omitted_production`);
    await queryRunner.query(`DROP TABLE IF EXISTS cost_report_omitted_entries`);
    await queryRunner.query(`DROP TABLE IF EXISTS cost_report_po_billing`);
  }
}
