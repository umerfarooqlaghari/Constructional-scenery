import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssetsAndHireEquipment1788500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. vehicles table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        registration_number VARCHAR(50) NOT NULL,
        make VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        year_of_manufacture INTEGER,
        number_plate VARCHAR(50),
        colour VARCHAR(50),
        vehicle_type VARCHAR(50),
        owner_assigned_to VARCHAR(100),
        notes TEXT,
        mot_expiry_date DATE,
        insurance_renewal_date DATE,
        tax_renewal_date DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. vehicle_compliance_alerts_sent table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vehicle_compliance_alerts_sent (
        id SERIAL PRIMARY KEY,
        vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        deadline_type VARCHAR(30) NOT NULL,
        expiry_date DATE NOT NULL,
        days_before INTEGER NOT NULL,
        sent_to VARCHAR(255) NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3. hire_equipment table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hire_equipment (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        equipment_type VARCHAR(100) NOT NULL,
        supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
        supplier_name VARCHAR(150) NOT NULL,
        description TEXT,
        production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
        hire_start_date DATE NOT NULL,
        weekly_hire_rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        return_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned')),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Indexes for fast querying & filtering
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_vehicles_registration ON vehicles(registration_number);
      CREATE INDEX IF NOT EXISTS idx_vehicles_mot_date ON vehicles(mot_expiry_date);
      CREATE INDEX IF NOT EXISTS idx_vehicles_insurance_date ON vehicles(insurance_renewal_date);
      CREATE INDEX IF NOT EXISTS idx_vehicles_tax_date ON vehicles(tax_renewal_date);

      CREATE INDEX IF NOT EXISTS idx_hire_equipment_production ON hire_equipment(production_id);
      CREATE INDEX IF NOT EXISTS idx_hire_equipment_status ON hire_equipment(status);
      CREATE INDEX IF NOT EXISTS idx_hire_equipment_supplier ON hire_equipment(supplier_name);
      CREATE INDEX IF NOT EXISTS idx_hire_equipment_start_date ON hire_equipment(hire_start_date);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS hire_equipment CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS vehicle_compliance_alerts_sent CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS vehicles CASCADE;`);
  }
}
