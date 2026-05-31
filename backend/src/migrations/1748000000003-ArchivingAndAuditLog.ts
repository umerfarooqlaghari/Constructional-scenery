import { MigrationInterface, QueryRunner } from 'typeorm';

export class ArchivingAndAuditLog1748000000003 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Add archived_at timestamp to productions
    await queryRunner.query(`
      ALTER TABLE productions
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ
    `);

    // Audit log table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID NOT NULL REFERENCES users(id),
        production_id UUID REFERENCES productions(id),
        action        TEXT NOT NULL,
        metadata      JSONB,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_production ON audit_log (production_id)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (user_id)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action)`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_log`);
    await queryRunner.query(
      `ALTER TABLE productions DROP COLUMN IF EXISTS archived_at`
    );
  }
}
