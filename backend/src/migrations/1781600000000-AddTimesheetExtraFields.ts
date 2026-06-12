import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimesheetExtraFields1781600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE timesheet_entries
        ADD COLUMN IF NOT EXISTS mileage              NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS per_diem             NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS ad_hoc_reimbursement NUMERIC DEFAULT 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE timesheet_entries
        DROP COLUMN IF EXISTS mileage,
        DROP COLUMN IF EXISTS per_diem,
        DROP COLUMN IF EXISTS ad_hoc_reimbursement
    `);
  }
}
