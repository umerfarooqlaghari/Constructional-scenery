import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrewDocumentsMeta1748000000008 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE crew_documents
        ADD COLUMN IF NOT EXISTS context_type    TEXT,
        ADD COLUMN IF NOT EXISTS file_key        TEXT,
        ADD COLUMN IF NOT EXISTS file_size       BIGINT,
        ADD COLUMN IF NOT EXISTS file_mime_type  TEXT
    `);

    // Backfill context_type from existing document_type values
    await queryRunner.query(`
      UPDATE crew_documents
      SET context_type = CASE
        WHEN document_type = 'contract' THEN 'crew_contract'
        ELSE 'crew_identity'
      END
      WHERE context_type IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE crew_documents
        DROP COLUMN IF EXISTS context_type,
        DROP COLUMN IF EXISTS file_key,
        DROP COLUMN IF EXISTS file_size,
        DROP COLUMN IF EXISTS file_mime_type
    `);
  }
}
