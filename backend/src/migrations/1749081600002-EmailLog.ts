import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the email_log table used to record every outbound email sent by the
 * system (timesheet distribution, invoice chasing, etc.).
 *
 * Two key use cases:
 *  - Audit trail: who was emailed, when, and whether it succeeded.
 *  - Duplicate prevention: invoice_chase module checks this table before
 *    re-sending a chase to a crew member already chased today.
 */
export class EmailLog1749081600002 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS email_log (
        id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        module            TEXT        NOT NULL,
        related_record_id UUID,
        recipient_email   TEXT        NOT NULL,
        recipient_name    TEXT,
        success           BOOLEAN     NOT NULL DEFAULT true,
        error_message     TEXT,
        sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_email_log_module
        ON email_log (module)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_email_log_recipient
        ON email_log (recipient_email, module, sent_at)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_email_log_record
        ON email_log (related_record_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS email_log`);
  }
}
