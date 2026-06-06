import { MigrationInterface, QueryRunner } from 'typeorm';

export class POWorkflowAndCostReport1748000000011 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Migrate existing PO statuses to new workflow
    await queryRunner.query(`
      UPDATE purchase_orders SET status = 'issued'          WHERE status = 'submitted'
    `);
    await queryRunner.query(`
      UPDATE purchase_orders SET status = 'pending_approval' WHERE status = 'invoice_received'
    `);

    // Replace status check constraint with new values
    await queryRunner.query(`
      ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check
    `);
    await queryRunner.query(`
      ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check
        CHECK (status IN ('draft', 'issued', 'pending_approval', 'approved'))
    `);

    // Cost report entries table (populated on PO approval, soft-deleted on revert)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cost_report_entries (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        production_id  UUID NOT NULL REFERENCES productions(id),
        entry_type     TEXT NOT NULL DEFAULT 'supplier',
        source_id      UUID NOT NULL,
        source_type    TEXT NOT NULL DEFAULT 'purchase_order',
        set_code       TEXT,
        account_code   TEXT,
        date           DATE NOT NULL,
        net_amount     DECIMAL(12,2) NOT NULL,
        vat            DECIMAL(12,2) NOT NULL DEFAULT 0,
        gross_amount   DECIMAL(12,2) NOT NULL,
        supplier_name  TEXT,
        po_number      TEXT,
        payment_method TEXT,
        deleted_at     TIMESTAMPTZ,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cost_report_entries_production
        ON cost_report_entries (production_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cost_report_entries_source
        ON cost_report_entries (source_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cost_report_entries_deleted
        ON cost_report_entries (deleted_at)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS cost_report_entries`);

    await queryRunner.query(`
      ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check
    `);
    await queryRunner.query(`
      ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check
        CHECK (status IN ('draft', 'submitted', 'issued', 'invoice_received', 'approved'))
    `);

    await queryRunner.query(`
      UPDATE purchase_orders SET status = 'submitted'       WHERE status = 'issued'
    `);
    await queryRunner.query(`
      UPDATE purchase_orders SET status = 'invoice_received' WHERE status = 'pending_approval'
    `);
  }
}
