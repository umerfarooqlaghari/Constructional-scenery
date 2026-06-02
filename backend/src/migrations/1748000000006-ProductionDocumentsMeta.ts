import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductionDocumentsMeta1748000000006 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE production_documents
        ADD COLUMN IF NOT EXISTS file_size      BIGINT,
        ADD COLUMN IF NOT EXISTS file_key       TEXT,
        ADD COLUMN IF NOT EXISTS file_mime_type TEXT
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE production_documents
        DROP COLUMN IF EXISTS file_size,
        DROP COLUMN IF EXISTS file_key,
        DROP COLUMN IF EXISTS file_mime_type
    `);
  }
}
