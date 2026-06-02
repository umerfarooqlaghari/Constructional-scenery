import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductionStatusLifecycle1748000000005 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Track rollback notice to show in header until next forward transition
    await queryRunner.query(`
      ALTER TABLE productions
        ADD COLUMN IF NOT EXISTS rollback_notice TEXT
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE productions DROP COLUMN IF EXISTS rollback_notice
    `);
  }
}
