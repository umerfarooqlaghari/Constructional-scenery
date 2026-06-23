import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The 1749081600001-TimesheetStatusRename migration was recorded as applied but
 * its SQL was rolled back (SSL timeout during the original run). The DB still has
 * the old CHECK constraint allowing only 'sent'/'reviewed'/'invoice_received'/'verified'.
 * This migration replaces it with the correct values.
 */
export class FixTimesheetStatusConstraint1781901000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Drop whichever constraint exists (both old and new name variants)
    await queryRunner.query(`
      ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_status_check
    `);

    // Migrate any rows still carrying legacy status values
    await queryRunner.query(`
      UPDATE timesheets
         SET status = CASE status
               WHEN 'sent'             THEN 'distributed'
               WHEN 'reviewed'         THEN 'amendment_requested'
               WHEN 'invoice_received' THEN 'finalised'
               WHEN 'verified'         THEN 'finalised'
               ELSE status
             END
       WHERE status IN ('sent', 'reviewed', 'invoice_received', 'verified')
    `);

    // Add the correct constraint
    await queryRunner.query(`
      ALTER TABLE timesheets ADD CONSTRAINT timesheets_status_check
        CHECK (status IN ('draft', 'distributed', 'amendment_requested', 'finalised'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_status_check
    `);

    await queryRunner.query(`
      UPDATE timesheets
         SET status = CASE status
               WHEN 'distributed'         THEN 'sent'
               WHEN 'amendment_requested' THEN 'reviewed'
               WHEN 'finalised'           THEN 'verified'
               ELSE status
             END
       WHERE status IN ('distributed', 'amendment_requested', 'finalised')
    `);

    await queryRunner.query(`
      ALTER TABLE timesheets ADD CONSTRAINT timesheets_status_check
        CHECK (status IN ('draft', 'sent', 'reviewed', 'invoice_received', 'verified'))
    `);
  }
}
