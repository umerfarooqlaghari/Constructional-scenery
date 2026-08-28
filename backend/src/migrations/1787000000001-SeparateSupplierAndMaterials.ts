import { MigrationInterface, QueryRunner } from "typeorm";

export class SeparateSupplierAndMaterials1787000000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Rename supplier_catalogue to materials_catalogue
        await queryRunner.query(`ALTER TABLE "supplier_catalogue" RENAME TO "materials_catalogue"`);
        
        // 2. Rename columns in forecast_materials_items
        await queryRunner.query(`ALTER TABLE "forecast_materials_items" RENAME COLUMN "supplier_catalogue_id" TO "materials_catalogue_id"`);

        // 3. Create suppliers table
        await queryRunner.query(`
            CREATE TABLE "suppliers" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" text NOT NULL,
                "email" text,
                "street_name" text,
                "city" text,
                "county" text,
                "zip_code" text,
                "phone" text,
                "notes" text,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_suppliers" PRIMARY KEY ("id")
            )
        `);

        // 4. Extract existing distinct suppliers from purchase_orders
        await queryRunner.query(`
            INSERT INTO "suppliers" ("name", "email", "street_name", "city", "county", "zip_code")
            SELECT 
                "supplier_name" as "name",
                MAX("supplier_email") as "email",
                MAX("street_name") as "street_name",
                MAX("city") as "city",
                MAX("county") as "county",
                MAX("zip_code") as "zip_code"
            FROM "purchase_orders"
            WHERE "supplier_name" IS NOT NULL AND "supplier_name" != ''
            GROUP BY "supplier_name"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "suppliers"`);
        await queryRunner.query(`ALTER TABLE "forecast_materials_items" RENAME COLUMN "materials_catalogue_id" TO "supplier_catalogue_id"`);
        await queryRunner.query(`ALTER TABLE "materials_catalogue" RENAME TO "supplier_catalogue"`);
    }
}
