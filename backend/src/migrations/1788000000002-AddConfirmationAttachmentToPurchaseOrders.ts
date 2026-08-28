import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddConfirmationAttachmentToPurchaseOrders1788000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('purchase_orders', new TableColumn({
      name: 'confirmation_attachment_url',
      type: 'text',
      isNullable: true,
    }));
    await queryRunner.addColumn('purchase_orders', new TableColumn({
      name: 'confirmation_attachment_name',
      type: 'text',
      isNullable: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('purchase_orders', 'confirmation_attachment_url');
    await queryRunner.dropColumn('purchase_orders', 'confirmation_attachment_name');
  }
}
