import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPOPendingApprovalStatus1781800000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Migration 1748000000011 renamed invoice_received → pending_approval in the data,
    // but the application code never adopted that name. This restores the data to match
    // what the controllers and frontend expect.
    await queryRunner.query(`
      UPDATE purchase_orders SET status = 'invoice_received' WHERE status = 'pending_approval'
    `);

    // Also fix any POs in 'issued' status that already have an invoice attached —
    // they should be in 'invoice_received' so the Approve button shows.
    await queryRunner.query(`
      UPDATE purchase_orders
      SET status = 'invoice_received'
      WHERE status = 'issued'
        AND invoice_attachment_url IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE purchase_orders SET status = 'pending_approval' WHERE status = 'invoice_received'
    `);
  }
}
