import { MigrationInterface, QueryRunner } from 'typeorm';

export class ArchiveByAndPercentometerReview1748000000004 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE productions
        ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS post_production_percentometer JSONB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE productions
        DROP COLUMN IF EXISTS archived_by,
        DROP COLUMN IF EXISTS post_production_percentometer
    `);
  }
}
