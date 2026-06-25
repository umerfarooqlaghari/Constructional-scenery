import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceNumberToWeeklyPL1782402108777 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cost_report_weekly_pl
        ADD COLUMN IF NOT EXISTS cs_invoice_number VARCHAR(50),
        ADD COLUMN IF NOT EXISTS po_reference      VARCHAR(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cost_report_weekly_pl
        DROP COLUMN IF EXISTS cs_invoice_number,
        DROP COLUMN IF EXISTS po_reference
    `);
  }
}
