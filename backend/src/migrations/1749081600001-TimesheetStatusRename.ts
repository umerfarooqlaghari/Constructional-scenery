import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renames the timesheets status enum from the old internal-tracking values
 * (sent / reviewed / invoice_received / verified) to the crew-facing workflow
 * values (distributed / amendment_requested / finalised).
 *
 * Also adds a DB-level UNIQUE constraint on (crew_member_id, production_id,
 * week_ending_date) to back-stop the application-level duplicate check.
 *
 * Status mapping (up):
 *   sent             → distributed
 *   reviewed         → distributed
 *   invoice_received → finalised
 *   verified         → finalised
 *
 * Status mapping (down):
 *   distributed          → sent
 *   amendment_requested  → reviewed
 *   finalised            → verified
 */
export class TimesheetStatusRename1749081600001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add DB-level uniqueness for (crew_member_id, production_id, week_ending_date).
    //    The application already enforces this; the index makes it a hard guarantee.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS timesheets_crew_prod_week_uniq
        ON timesheets (crew_member_id, production_id, week_ending_date)
    `);

    // 2. Drop the old status CHECK constraint (name follows the project convention).
    await queryRunner.query(`
      ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_status_check
    `);

    // 3. Migrate existing rows to the new status values before tightening the constraint.
    await queryRunner.query(`
      UPDATE timesheets
         SET status = CASE status
               WHEN 'sent'             THEN 'distributed'
               WHEN 'reviewed'         THEN 'distributed'
               WHEN 'invoice_received' THEN 'finalised'
               WHEN 'verified'         THEN 'finalised'
               ELSE status
             END
       WHERE status IN ('sent', 'reviewed', 'invoice_received', 'verified')
    `);

    // 4. Enforce the new set of allowed values.
    await queryRunner.query(`
      ALTER TABLE timesheets ADD CONSTRAINT timesheets_status_check
        CHECK (status IN ('draft', 'distributed', 'amendment_requested', 'finalised'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse step 4
    await queryRunner.query(`
      ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_status_check
    `);

    // Reverse step 3
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

    // Reverse step 2 — restore old constraint
    await queryRunner.query(`
      ALTER TABLE timesheets ADD CONSTRAINT timesheets_status_check
        CHECK (status IN ('draft', 'sent', 'reviewed', 'invoice_received', 'verified'))
    `);

    // Reverse step 1
    await queryRunner.query(`
      DROP INDEX IF EXISTS timesheets_crew_prod_week_uniq
    `);
  }
}
