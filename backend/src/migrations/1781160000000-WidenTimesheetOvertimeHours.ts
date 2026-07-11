import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenTimesheetOvertimeHours1781160000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE timesheet_entries
        ALTER COLUMN overtime_hours TYPE NUMERIC(6,2)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE timesheet_entries
        ALTER COLUMN overtime_hours TYPE NUMERIC(4,2)
    `);
  }
}