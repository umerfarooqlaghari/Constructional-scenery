import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPurchaseOrderStatusConstraint1780998716025 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the existing status check constraint (whatever values it currently has)
    await queryRunner.query(`
      ALTER TABLE purchase_orders
      DROP CONSTRAINT IF EXISTS purchase_orders_status_check
    `);

    // Re-add it with the full correct set of values
    await queryRunner.query(`
      ALTER TABLE purchase_orders
      ADD CONSTRAINT purchase_orders_status_check
      CHECK (status IN ('draft', 'submitted', 'issued', 'invoice_received', 'approved'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE purchase_orders
      DROP CONSTRAINT IF EXISTS purchase_orders_status_check
    `);

    await queryRunner.query(`
      ALTER TABLE purchase_orders
      ADD CONSTRAINT purchase_orders_status_check
      CHECK (status IN ('draft', 'issued', 'pending_approval', 'approved'))
    `);
  }
}
