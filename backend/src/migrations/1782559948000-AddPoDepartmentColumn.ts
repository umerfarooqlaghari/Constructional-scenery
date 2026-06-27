import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPoDepartmentColumn1782559948000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE purchase_orders
        ADD COLUMN IF NOT EXISTS department TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE purchase_orders
        DROP COLUMN IF EXISTS department
    `);
  }
}
