import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTitleToPurchaseOrders1788000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('purchase_orders', new TableColumn({
      name: 'title',
      type: 'varchar',
      length: '255',
      isNullable: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('purchase_orders', 'title');
  }
}
