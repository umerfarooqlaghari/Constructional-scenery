# CS HQ Backend API

Node.js + Express + Supabase (PostgreSQL + Auth) backend for CS HQ — Construct Scenery Limited's bespoke business management platform.

## Setup

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your **Project URL** and **API keys** (Settings → API)

### 2. Run the Database Schema
1. Open the **Supabase SQL Editor** in your project dashboard
2. Copy and paste the contents of `db/schema.sql` and run it
3. This creates all 20+ tables, indexes, triggers, and seeds the Percentometer ratios + BECTU rate structure

### 3. Fill in BECTU Rates
After running the schema, update the `bectu_rates` table with the actual 2026/27 Pact/BECTU rate card figures:
```sql
UPDATE bectu_rates SET daily_rate = 250.00, overtime_rate = 35.00
WHERE trade = 'Carpenters' AND rank = 'Carpenter';
-- ... repeat for all trades/ranks
```

### 4. Configure Environment Variables
Copy `.env` and fill in your Supabase credentials:
```
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CLIENT_URL=http://localhost:3000
```

### 5. Install & Run
```bash
npm install
npm run dev       # development (nodemon)
npm start         # production
```

---

## API Modules

| Route | Module | Description |
|-------|--------|-------------|
| `/api/auth` | Auth | Signup, login, logout, token refresh |
| `/api/productions` | Module 7 | Productions + set tracker |
| `/api/purchase-orders` | Module 1 | Full PO lifecycle |
| `/api/crew` | Module 2 | Crew database + documents |
| `/api/timesheets` | Module 3 | Timesheets + bulk distribute + invoice chase |
| `/api/pay-runs` | Module 3 | Pay run processing + CSV export |
| `/api/cost-reports` | Module 4 | Type 1 (On a Price) + Type 2 (Cost Plus) |
| `/api/forecasting` | Module 5 | Forecasts + Percentometer + supplier catalogue |
| `/api/dashboard` | Module 6 | Warren's dashboard aggregation |

---

## Authentication

All routes (except `GET /`) require a Bearer token in the `Authorization` header:
```
Authorization: Bearer <supabase_access_token>
```

Tokens are obtained from `POST /api/auth/login` and must be refreshed via `POST /api/auth/refresh`.

## User Roles

| Role | Access |
|------|--------|
| `managing_director` | Full access to all modules + dashboard |
| `construction_accountant` | Timesheets, pay run, cost report, crew DB |
| `construction_coordinator` | POs, crew DB, productions, set tracker |

## File Uploads (Documents)
File uploads (crew documents, PO invoices, production documents) use **Supabase Storage**.
The API stores the file URL — upload files to Supabase Storage from the frontend, then pass the URL to the relevant endpoint.

## Integrations (TODO)
- **Microsoft Outlook** — PO issuance, timesheet distribution, invoice chase, handover alerts  
  → Implement via Microsoft Graph API (`/api/auth` OAuth flow)
- **Xero** — cash flow snapshot on Warren's Dashboard  
  → Quoted separately, feasibility to be confirmed

---

## Database Structure

```
productions            ← Module 7 hub
├── sets               ← set tracker
├── production_documents
├── production_crew    ← crew ↔ production junction
├── purchase_orders    ← Module 1
├── timesheets         ← Module 3
│   └── timesheet_entries
├── pay_runs
│   └── pay_run_items
├── cost_report_invoices
├── cost_plus_budgets
└── forecasts          ← Module 5
    ├── forecast_labour_items
    └── forecast_materials_items

crew_members           ← Module 2
└── crew_documents

supplier_catalogue     ← Module 5
bectu_rates            ← Module 2 + 3 + 5
percentometer_ratios   ← Module 5
user_profiles          ← Auth
```
