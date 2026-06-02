import { MigrationInterface, QueryRunner } from 'typeorm';

export class HandoverAlertLog1748000000007 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS handover_alerts_sent (
        id         SERIAL PRIMARY KEY,
        set_id     UUID    NOT NULL,
        days_mark  INTEGER NOT NULL,
        sent_date  DATE    NOT NULL DEFAULT CURRENT_DATE,
        UNIQUE (set_id, days_mark, sent_date)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS handover_alerts_sent`);
  }
}
