import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1748000000000 implements MigrationInterface {
  name = 'InitialSchema1748000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Users & Auth
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name     TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN (
                        'managing_director',
                        'construction_accountant',
                        'construction_coordinator'
                      )),
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        token      TEXT NOT NULL UNIQUE,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token   ON refresh_tokens(token)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`);

    // Productions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS productions (
        id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name                TEXT NOT NULL,
        production_company  TEXT,
        production_designer TEXT,
        production_type     TEXT,
        start_date          DATE,
        end_date            DATE,
        contract_type       TEXT NOT NULL CHECK (contract_type IN ('on_a_price', 'cost_plus')),
        status              TEXT NOT NULL DEFAULT 'pre_production'
                              CHECK (status IN (
                                'pre_production', 'active_build', 'strike', 'complete', 'archived'
                              )),
        created_by          UUID REFERENCES users(id),
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sets (
        id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        production_id     UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
        set_number        TEXT,
        set_name          TEXT NOT NULL,
        shoot_week        TEXT,
        handover_date     DATE,
        completion_status TEXT NOT NULL DEFAULT 'not_started'
                            CHECK (completion_status IN (
                              'not_started', 'in_progress', 'nearing_completion', 'complete', 'handed_over'
                            )),
        notes             TEXT,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS production_documents (
        id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        production_id   UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
        document_type   TEXT,
        file_url        TEXT NOT NULL,
        file_name       TEXT NOT NULL,
        uploaded_by     UUID REFERENCES users(id),
        uploaded_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Crew Database
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS crew_members (
        id                              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        crew_number                     TEXT UNIQUE NOT NULL,
        first_name                      TEXT NOT NULL,
        last_name                       TEXT NOT NULL,
        date_of_birth                   DATE,
        home_address                    TEXT,
        employment_status               TEXT NOT NULL CHECK (employment_status IN ('paye', 'self_employed')),
        crew_trade                      TEXT NOT NULL,
        crew_rank                       TEXT NOT NULL,
        paye_withholding_rate           DECIMAL(5,2) DEFAULT 0,
        company_name                    TEXT,
        company_registration_number     TEXT,
        vat_registration_number         TEXT,
        email                           TEXT,
        account_name                    TEXT,
        account_number                  TEXT,
        sort_code                       TEXT,
        emergency_contact_name          TEXT,
        emergency_contact_relationship  TEXT,
        emergency_contact_phone         TEXT,
        is_active                       BOOLEAN DEFAULT TRUE,
        created_at                      TIMESTAMPTZ DEFAULT NOW(),
        updated_at                      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS production_crew (
        id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        production_id   UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
        crew_member_id  UUID NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
        start_date      DATE,
        end_date        DATE,
        contract_url    TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(production_id, crew_member_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS crew_documents (
        id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        crew_member_id  UUID NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
        document_type   TEXT NOT NULL CHECK (document_type IN ('government_id', 'contract', 'other')),
        production_id   UUID REFERENCES productions(id),
        file_url        TEXT NOT NULL,
        file_name       TEXT NOT NULL,
        uploaded_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Purchase Orders
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        po_number                 TEXT UNIQUE NOT NULL,
        supplier_name             TEXT NOT NULL,
        supplier_email            TEXT,
        supplier_address          TEXT,
        date_of_po                DATE NOT NULL DEFAULT CURRENT_DATE,
        production_id             UUID NOT NULL REFERENCES productions(id),
        set_code                  TEXT,
        account_code              TEXT,
        description               TEXT,
        net_amount                DECIMAL(12,2) NOT NULL,
        vat                       DECIMAL(12,2) DEFAULT 0,
        gross_amount              DECIMAL(12,2) NOT NULL,
        paid_from                 TEXT CHECK (paid_from IN (
                                    'supplier_account',
                                    'arbuthnot_current_account',
                                    'charge_card',
                                    'pleo_charge_card'
                                  )),
        invoice_attachment_url    TEXT,
        invoice_attachment_name   TEXT,
        status                    TEXT NOT NULL DEFAULT 'draft'
                                    CHECK (status IN (
                                      'draft', 'submitted', 'issued', 'invoice_received', 'approved'
                                    )),
        created_by                UUID REFERENCES users(id),
        approved_by               UUID REFERENCES users(id),
        approved_at               TIMESTAMPTZ,
        created_at                TIMESTAMPTZ DEFAULT NOW(),
        updated_at                TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Timesheets
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS timesheets (
        id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        crew_member_id            UUID NOT NULL REFERENCES crew_members(id),
        production_id             UUID NOT NULL REFERENCES productions(id),
        week_ending_date          DATE NOT NULL,
        status                    TEXT NOT NULL DEFAULT 'draft'
                                    CHECK (status IN (
                                      'draft', 'sent', 'reviewed', 'invoice_received', 'verified'
                                    )),
        invoice_attachment_url    TEXT,
        invoice_attachment_name   TEXT,
        weekly_rate               DECIMAL(12,2) DEFAULT 0,
        sixth_day_payment         DECIMAL(12,2) DEFAULT 0,
        seventh_day_payment       DECIMAL(12,2) DEFAULT 0,
        overtime_amount           DECIMAL(12,2) DEFAULT 0,
        meal_allowance_total      DECIMAL(12,2) DEFAULT 0,
        mileage_and_travel        DECIMAL(12,2) DEFAULT 0,
        vat                       DECIMAL(12,2) DEFAULT 0,
        gross_total               DECIMAL(12,2) DEFAULT 0,
        grand_total               DECIMAL(12,2) DEFAULT 0,
        created_by                UUID REFERENCES users(id),
        created_at                TIMESTAMPTZ DEFAULT NOW(),
        updated_at                TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(crew_member_id, production_id, week_ending_date)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS timesheet_entries (
        id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        timesheet_id    UUID NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
        date            DATE NOT NULL,
        day_of_week     TEXT NOT NULL,
        full_day_worked BOOLEAN DEFAULT FALSE,
        overtime_hours  DECIMAL(4,2) DEFAULT 0,
        set_number      TEXT,
        site            TEXT,
        travel          DECIMAL(8,2) DEFAULT 0,
        meal_breakfast  BOOLEAN DEFAULT FALSE,
        meal_lunch      BOOLEAN DEFAULT FALSE,
        meal_supper     BOOLEAN DEFAULT FALSE,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pay_runs (
        id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        production_id    UUID NOT NULL REFERENCES productions(id),
        week_ending_date DATE NOT NULL,
        status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processed')),
        created_by       UUID REFERENCES users(id),
        processed_at     TIMESTAMPTZ,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(production_id, week_ending_date)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pay_run_items (
        id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        pay_run_id         UUID NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
        timesheet_id       UUID NOT NULL REFERENCES timesheets(id),
        crew_member_id     UUID NOT NULL REFERENCES crew_members(id),
        employment_type    TEXT,
        gross_amount       DECIMAL(12,2) NOT NULL,
        withholding_amount DECIMAL(12,2) DEFAULT 0,
        net_amount         DECIMAL(12,2) NOT NULL,
        sort_code          TEXT,
        account_number     TEXT,
        account_name       TEXT,
        reference          TEXT,
        created_at         TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Cost Reports
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cost_report_invoices (
        id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        production_id       UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
        invoice_description TEXT,
        po_number           TEXT,
        date                DATE,
        invoice_number      TEXT,
        amount              DECIMAL(12,2) NOT NULL,
        notes               TEXT,
        created_at          TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cost_plus_budgets (
        id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        production_id    UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE UNIQUE,
        total_budget     DECIMAL(14,2),
        margin_rate      DECIMAL(5,4) DEFAULT 0.10,
        contracted_weeks INTEGER DEFAULT 0,
        budget_lines     JSONB,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Forecasting
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS forecasts (
        id                            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name                          TEXT NOT NULL,
        production_id                 UUID REFERENCES productions(id),
        total_labour_cost             DECIMAL(14,2) DEFAULT 0,
        total_materials_cost          DECIMAL(14,2) DEFAULT 0,
        total_forecast_cost           DECIMAL(14,2) DEFAULT 0,
        percentometer_carpenter_cost  DECIMAL(14,2),
        percentometer_total           DECIMAL(14,2),
        created_by                    UUID REFERENCES users(id),
        created_at                    TIMESTAMPTZ DEFAULT NOW(),
        updated_at                    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS forecast_labour_items (
        id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        forecast_id     UUID NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
        crew_type       TEXT NOT NULL,
        number_of_crew  INTEGER DEFAULT 1,
        number_of_weeks INTEGER DEFAULT 1,
        overtime_hours  DECIMAL(6,2) DEFAULT 0,
        weekly_rate     DECIMAL(10,2),
        overtime_rate   DECIMAL(10,2),
        subtotal        DECIMAL(14,2),
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS supplier_catalogue (
        id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        supplier_name       TEXT NOT NULL,
        product_description TEXT NOT NULL,
        unit_of_measure     TEXT,
        unit_price          DECIMAL(10,2) NOT NULL,
        notes               TEXT,
        is_active           BOOLEAN DEFAULT TRUE,
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS forecast_materials_items (
        id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        forecast_id           UUID NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
        supplier_catalogue_id UUID REFERENCES supplier_catalogue(id),
        supplier_name         TEXT,
        product_description   TEXT,
        quantity              DECIMAL(10,2) DEFAULT 1,
        unit_price            DECIMAL(10,2),
        subtotal              DECIMAL(14,2),
        created_at            TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS percentometer_ratios (
        id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        cost_type   TEXT NOT NULL UNIQUE,
        percentage  DECIMAL(5,4) NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      INSERT INTO percentometer_ratios (cost_type, percentage) VALUES
        ('Carpenters',  0.42), ('Painters',    0.18), ('Stagehands',  0.09),
        ('Riggers',     0.06), ('Timber',       0.09), ('Plasterwork', 0.06),
        ('Misc',        0.03), ('Sculptors',    0.02), ('Metalwork',   0.02),
        ('Paint',       0.02), ('Glass',        0.01)
      ON CONFLICT (cost_type) DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bectu_rates (
        id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        trade         TEXT NOT NULL,
        rank          TEXT NOT NULL,
        daily_rate    DECIMAL(10,2),
        overtime_rate DECIMAL(10,2),
        weekly_rate   DECIMAL(10,2),
        rate_year     TEXT DEFAULT '2026/27',
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(trade, rank, rate_year)
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_purchase_orders_production  ON purchase_orders(production_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_purchase_orders_status      ON purchase_orders(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_purchase_orders_date        ON purchase_orders(date_of_po)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_timesheets_crew             ON timesheets(crew_member_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_timesheets_production       ON timesheets(production_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_timesheets_week             ON timesheets(week_ending_date)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheet ON timesheet_entries(timesheet_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sets_production             ON sets(production_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sets_handover               ON sets(handover_date)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_forecasts_production        ON forecasts(production_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_production_crew_production  ON production_crew(production_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_production_crew_member      ON production_crew(crew_member_id)`);

    // updated_at trigger function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    const triggerTables = [
      'users', 'productions', 'crew_members',
      'purchase_orders', 'timesheets', 'forecasts',
      'supplier_catalogue', 'cost_plus_budgets',
    ];
    for (const table of triggerTables) {
      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'trg_${table}_updated_at'
          ) THEN
            CREATE TRIGGER trg_${table}_updated_at
              BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION update_updated_at();
          END IF;
        END $$
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'bectu_rates', 'percentometer_ratios', 'forecast_materials_items',
      'supplier_catalogue', 'forecast_labour_items', 'forecasts',
      'cost_plus_budgets', 'cost_report_invoices', 'pay_run_items',
      'pay_runs', 'timesheet_entries', 'timesheets', 'purchase_orders',
      'crew_documents', 'production_crew', 'crew_members',
      'production_documents', 'sets', 'productions',
      'refresh_tokens', 'users',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at() CASCADE`);
  }
}
