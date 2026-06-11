import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPurchaseOrderAddressFields1780998716027 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE purchase_orders
        ADD COLUMN IF NOT EXISTS supplier_code TEXT,
        ADD COLUMN IF NOT EXISTS street_name   TEXT,
        ADD COLUMN IF NOT EXISTS zip_code      TEXT,
        ADD COLUMN IF NOT EXISTS city          TEXT,
        ADD COLUMN IF NOT EXISTS county        TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE purchase_orders
        DROP COLUMN IF EXISTS supplier_code,
        DROP COLUMN IF EXISTS street_name,
        DROP COLUMN IF EXISTS zip_code,
        DROP COLUMN IF EXISTS city,
        DROP COLUMN IF EXISTS county
    `);
  }
}
