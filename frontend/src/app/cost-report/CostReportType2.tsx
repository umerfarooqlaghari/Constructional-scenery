'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type BudgetLine = {
  id: string; account_code: string | null; description: string;
  weekly_cost: number; weeks: number; total: number; sort_order: number;
};

type MainCostRow = {
  account_code: string | null; description: string;
  weekly_cost: number; margin_pct: number; sub_total: number;
  weeks: number; budget: number;
  labour_costs_to_date: number; materials_costs_to_date: number;
  total_costs_to_date: number; over_under_budget: number;
};

type POBillingRow = {
  source_id: string; po_number: string | null;
  cs_invoice_number: string | null; po_value: number;
  amount_invoiced: number; amount_still_to_invoice: number;
  is_omitted: boolean;
};

type WeeklyInvoiceRow = {
  week_number: number; week_ending_date: string;
  above_line_labour_charged: number; labour_charged: number;
  materials: number; released_advance: number; charged_so_far: number;
  cs_invoice_number: string | null; po_reference: string | null;
};

type LabourRow = {
  week_ending_date: string; transaction_description: string;
  account_code: string | null; account_description: string;
  net_amount_charged: number; margin_amount: number;
  cost_to_production: number; crew_name: string; crew_number: string;
};

type MaterialRow = {
  week_ending_date: string; po_number: string | null;
  invoice_date: string; supplier: string;
  account_code: string | null; account_description: string;
  transaction_description: string; net_amount: number;
  margin_amount: number; recharge_to_production: number; set_code: string | null;
};

type PLRow = {
  week_ending_date: string;
  margin_from_recharged_costs: number;
  warrens_salary: number; weekly_profit: number; running_total_profit: number;
};

export type Type2Report = {
  production: { id: string; name: string; contract_type: string; status: string };
  budget: { margin_rate: number; contracted_weeks: number; budget_lines: BudgetLine[] } | null;
  main_cost_report: MainCostRow[];
  summary: {
    margin_rate: number; margin_pct: string;
    total_labour_ctp: number; total_materials_ctp: number;
    grand_total_ctp: number; total_invoiced_to_production: number;
  };
  pos_and_billing: POBillingRow[];
  weekly_invoice_summary: WeeklyInvoiceRow[];
  labour_to_send: LabourRow[];
  materials_to_send: MaterialRow[];
  omitted_entries: Array<{ id: string; entry_id: string; omit_reason: string | null; created_at: string }>;
  margins_reference: { items: string[]; notes: string | null } | null;
  weekly_pl: PLRow[];
  invoices_to_production: Array<{ id: string; amount: string; date: string; invoice_number: string | null }>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(n || 0);

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'main',      label: 'Main Cost Report' },
  { id: 'pos',       label: 'POs & Amount to Bill' },
  { id: 'labour',    label: 'Labour to Send' },
  { id: 'materials', label: 'Materials to Send' },
  { id: 'weekly',    label: 'Weekly Invoice Summary' },
  { id: 'budget',    label: 'Master Budget' },
  { id: 'pl',        label: "Warren's P&L" },
  { id: 'omitted',   label: 'Omitted Entries' },
  { id: 'margins',   label: 'Margins Reference' },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Table wrapper ────────────────────────────────────────────────────────────

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-semibold text-slate-500 bg-slate-50 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, right, bold, green, red }: { children: React.ReactNode; right?: boolean; bold?: boolean; green?: boolean; red?: boolean }) {
  return (
    <td className={`px-4 py-3 text-sm whitespace-nowrap border-b border-slate-100 ${right ? 'text-right' : ''} ${bold ? 'font-semibold text-slate-900' : 'text-slate-700'} ${green ? 'text-green-700 font-semibold' : ''} ${red ? 'text-red-600 font-semibold' : ''}`}>
      {children}
    </td>
  );
}

function EmptyRow({ cols, label = 'No data' }: { cols: number; label?: string }) {
  return (
    <tr><td colSpan={cols} className="px-4 py-8 text-center text-slate-400 text-sm">{label}</td></tr>
  );
}

// ─── Summary banner ───────────────────────────────────────────────────────────

function SummaryBanner({ summary }: { summary: Type2Report['summary'] }) {
  const balance = summary.grand_total_ctp - summary.total_invoiced_to_production;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: 'Margin Rate', value: summary.margin_pct, sub: 'configurable per line' },
        { label: 'Total Labour CTP', value: fmt(summary.total_labour_ctp), sub: 'inc. margin' },
        { label: 'Total Materials CTP', value: fmt(summary.total_materials_ctp), sub: 'inc. margin' },
        { label: 'Grand Total CTP', value: fmt(summary.grand_total_ctp), sub: `Invoiced: ${fmt(summary.total_invoiced_to_production)}`, highlight: balance !== 0, over: balance > 0 },
      ].map(s => (
        <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-slate-500 text-xs font-medium">{s.label}</p>
          <p className={`text-xl font-bold mt-0.5 ${s.over ? 'text-red-600' : 'text-slate-900'}`}>{s.value}</p>
          <p className="text-slate-400 text-xs mt-0.5">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Main Cost Report ────────────────────────────────────────────────────

function TabMainCostReport({ rows }: { rows: MainCostRow[] }) {
  const totals = rows.reduce((acc, r) => ({
    budget: acc.budget + r.budget,
    labour: acc.labour + r.labour_costs_to_date,
    materials: acc.materials + r.materials_costs_to_date,
    total: acc.total + r.total_costs_to_date,
    over_under: acc.over_under + r.over_under_budget,
  }), { budget: 0, labour: 0, materials: 0, total: 0, over_under: 0 });

  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>Account Code</Th>
          <Th>Description</Th>
          <Th right>Weekly Cost</Th>
          <Th right>Margin %</Th>
          <Th right>Sub Total</Th>
          <Th right>Weeks</Th>
          <Th right>Budget</Th>
          <Th right>Labour CTD</Th>
          <Th right>Materials CTD</Th>
          <Th right>Total CTD</Th>
          <Th right>Over/Under</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? <EmptyRow cols={11} label="No budget lines — set up the Master Budget first" /> : rows.map((r, i) => {
          const over = r.over_under_budget < 0;
          return (
            <tr key={i} className="hover:bg-slate-50/50">
              <Td><span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.account_code ?? '—'}</span></Td>
              <Td>{r.description}</Td>
              <Td right>{fmt(r.weekly_cost)}</Td>
              <Td right>{r.margin_pct.toFixed(0)}%</Td>
              <Td right>{fmt(r.sub_total)}</Td>
              <Td right>{r.weeks}</Td>
              <Td right bold>{fmt(r.budget)}</Td>
              <Td right>{fmt(r.labour_costs_to_date)}</Td>
              <Td right>{fmt(r.materials_costs_to_date)}</Td>
              <Td right bold>{fmt(r.total_costs_to_date)}</Td>
              <Td right green={!over} red={over}>{over ? '-' : '+'}{fmt(Math.abs(r.over_under_budget))}</Td>
            </tr>
          );
        })}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr className="bg-slate-50 border-t-2 border-slate-200">
            <td colSpan={6} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Totals</td>
            <Td right bold>{fmt(totals.budget)}</Td>
            <Td right bold>{fmt(totals.labour)}</Td>
            <Td right bold>{fmt(totals.materials)}</Td>
            <Td right bold>{fmt(totals.total)}</Td>
            <Td right bold green={totals.over_under >= 0} red={totals.over_under < 0}>
              {totals.over_under < 0 ? '-' : '+'}{fmt(Math.abs(totals.over_under))}
            </Td>
          </tr>
        </tfoot>
      )}
    </TableWrap>
  );
}

// ─── Tab: POs & Amount to Bill ────────────────────────────────────────────────

function TabPOsBilling({ rows }: { rows: POBillingRow[] }) {
  const totalValue    = rows.reduce((s, r) => s + r.po_value, 0);
  const totalInvoiced = rows.reduce((s, r) => s + r.amount_invoiced, 0);
  const totalStill    = rows.reduce((s, r) => s + r.amount_still_to_invoice, 0);

  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>PO Number</Th>
          <Th>CS Invoice #</Th>
          <Th right>PO Value</Th>
          <Th right>Amount Invoiced</Th>
          <Th right>Still to Invoice</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? <EmptyRow cols={6} label="No POs on this production" /> : rows.map((r, i) => (
          <tr key={i} className={`hover:bg-slate-50/50 ${r.is_omitted ? 'opacity-50' : ''}`}>
            <Td><span className="font-mono text-xs">{r.po_number ?? '—'}</span></Td>
            <Td><span className={`text-xs ${r.cs_invoice_number ? 'font-medium text-slate-900' : 'text-slate-400 italic'}`}>{r.cs_invoice_number ?? 'Not set'}</span></Td>
            <Td right bold>{fmt(r.po_value)}</Td>
            <Td right>{fmt(r.amount_invoiced)}</Td>
            <Td right red={r.amount_still_to_invoice > 0}>{fmt(r.amount_still_to_invoice)}</Td>
            <Td><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.is_omitted ? 'bg-slate-100 text-slate-500' : r.amount_still_to_invoice <= 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{r.is_omitted ? 'Omitted' : r.amount_still_to_invoice <= 0 ? 'Fully billed' : 'Pending'}</span></Td>
          </tr>
        ))}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr className="bg-slate-50 border-t-2 border-slate-200">
            <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Totals</td>
            <Td right bold>{fmt(totalValue)}</Td>
            <Td right bold>{fmt(totalInvoiced)}</Td>
            <Td right bold red={totalStill > 0}>{fmt(totalStill)}</Td>
            <td />
          </tr>
        </tfoot>
      )}
    </TableWrap>
  );
}

// ─── Tab: Labour to Send Production ──────────────────────────────────────────

function TabLabour({ rows }: { rows: LabourRow[] }) {
  const totalNet    = rows.reduce((s, r) => s + r.net_amount_charged, 0);
  const totalMargin = rows.reduce((s, r) => s + r.margin_amount, 0);
  const totalCTP    = rows.reduce((s, r) => s + r.cost_to_production, 0);

  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>Week Ending</Th>
          <Th>Crew Member</Th>
          <Th>Account / Set</Th>
          <Th>Description</Th>
          <Th right>Net Amount</Th>
          <Th right>Margin</Th>
          <Th right>Cost to Production</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? <EmptyRow cols={7} label="No approved labour this period" /> : rows.map((r, i) => (
          <tr key={i} className="hover:bg-slate-50/50">
            <Td>{fmtDate(r.week_ending_date)}</Td>
            <Td><span className="font-medium text-slate-900">{r.crew_name}</span><span className="text-slate-400 text-xs ml-1">{r.crew_number}</span></Td>
            <Td><span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.account_code ?? '—'}</span></Td>
            <Td>{r.account_description}</Td>
            <Td right>{fmt(r.net_amount_charged)}</Td>
            <Td right>{fmt(r.margin_amount)}</Td>
            <Td right bold>{fmt(r.cost_to_production)}</Td>
          </tr>
        ))}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr className="bg-slate-50 border-t-2 border-slate-200">
            <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Totals</td>
            <Td right bold>{fmt(totalNet)}</Td>
            <Td right bold>{fmt(totalMargin)}</Td>
            <Td right bold>{fmt(totalCTP)}</Td>
          </tr>
        </tfoot>
      )}
    </TableWrap>
  );
}

// ─── Tab: Materials to Send Production ───────────────────────────────────────

function TabMaterials({ rows }: { rows: MaterialRow[] }) {
  const totalNet    = rows.reduce((s, r) => s + r.net_amount, 0);
  const totalMargin = rows.reduce((s, r) => s + r.margin_amount, 0);
  const totalCTP    = rows.reduce((s, r) => s + r.recharge_to_production, 0);

  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>Week Ending</Th>
          <Th>PO Number</Th>
          <Th>Supplier</Th>
          <Th>Account Code</Th>
          <Th>Set</Th>
          <Th right>Net Amount</Th>
          <Th right>Margin</Th>
          <Th right>Recharge to Production</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? <EmptyRow cols={8} label="No approved materials this period" /> : rows.map((r, i) => (
          <tr key={i} className="hover:bg-slate-50/50">
            <Td>{fmtDate(r.week_ending_date)}</Td>
            <Td><span className="font-mono text-xs">{r.po_number ?? '—'}</span></Td>
            <Td bold>{r.supplier}</Td>
            <Td><span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.account_code ?? '—'}</span></Td>
            <Td>{r.set_code ?? '—'}</Td>
            <Td right>{fmt(r.net_amount)}</Td>
            <Td right>{fmt(r.margin_amount)}</Td>
            <Td right bold>{fmt(r.recharge_to_production)}</Td>
          </tr>
        ))}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr className="bg-slate-50 border-t-2 border-slate-200">
            <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Totals</td>
            <Td right bold>{fmt(totalNet)}</Td>
            <Td right bold>{fmt(totalMargin)}</Td>
            <Td right bold>{fmt(totalCTP)}</Td>
          </tr>
        </tfoot>
      )}
    </TableWrap>
  );
}

// ─── Tab: Weekly Invoice Summary ──────────────────────────────────────────────

function TabWeeklyInvoice({ rows }: { rows: WeeklyInvoiceRow[] }) {
  const totalCharged = rows.reduce((s, r) => s + r.charged_so_far, 0);
  const totalLabour  = rows.reduce((s, r) => s + r.labour_charged, 0);
  const totalMat     = rows.reduce((s, r) => s + r.materials, 0);

  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>Wk #</Th>
          <Th>Week Ending</Th>
          <Th right>Above Line Labour</Th>
          <Th right>Labour Charged</Th>
          <Th right>Materials</Th>
          <Th right>Released Advance</Th>
          <Th right>Charged So Far</Th>
          <Th>CS Invoice #</Th>
          <Th>PO Reference</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? <EmptyRow cols={9} label="No weekly data yet" /> : rows.map((r, i) => (
          <tr key={i} className="hover:bg-slate-50/50">
            <Td><span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{r.week_number}</span></Td>
            <Td bold>{fmtDate(r.week_ending_date)}</Td>
            <Td right>{fmt(r.above_line_labour_charged)}</Td>
            <Td right>{fmt(r.labour_charged)}</Td>
            <Td right>{fmt(r.materials)}</Td>
            <Td right>{fmt(r.released_advance)}</Td>
            <Td right bold>{fmt(r.charged_so_far)}</Td>
            <Td>{r.cs_invoice_number ?? <span className="text-slate-400 italic text-xs">Not set</span>}</Td>
            <Td>{r.po_reference ?? <span className="text-slate-400 italic text-xs">—</span>}</Td>
          </tr>
        ))}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr className="bg-slate-50 border-t-2 border-slate-200">
            <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Totals</td>
            <td className="px-4 py-3" />
            <Td right bold>{fmt(totalLabour)}</Td>
            <Td right bold>{fmt(totalMat)}</Td>
            <td className="px-4 py-3" />
            <Td right bold>{fmt(totalCharged)}</Td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      )}
    </TableWrap>
  );
}

// ─── Tab: Master Budget ───────────────────────────────────────────────────────

function TabMasterBudget({ budget }: { budget: Type2Report['budget'] }) {
  if (!budget) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl px-5 py-12 text-center">
        <p className="text-slate-500 text-sm font-medium">No budget configured yet</p>
        <p className="text-slate-400 text-xs mt-1">Set up the Master Budget via the API or budget editor</p>
      </div>
    );
  }

  const lines = budget.budget_lines ?? [];
  const total = lines.reduce((s, l) => s + (l.total || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-slate-500 text-xs">Margin Rate</p>
          <p className="text-slate-900 text-xl font-bold mt-0.5">{((budget.margin_rate || 0) * 100).toFixed(0)}%</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-slate-500 text-xs">Contracted Weeks</p>
          <p className="text-slate-900 text-xl font-bold mt-0.5">{budget.contracted_weeks ?? '—'}</p>
        </div>
      </div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Account Code</Th>
            <Th>Description</Th>
            <Th right>Weekly Cost</Th>
            <Th right>Weeks</Th>
            <Th right>Total</Th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? <EmptyRow cols={5} label="No budget lines" /> : lines.map((l, i) => (
            <tr key={i} className="hover:bg-slate-50/50">
              <Td><span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{l.account_code ?? '—'}</span></Td>
              <Td>{l.description}</Td>
              <Td right>{fmt(l.weekly_cost)}</Td>
              <Td right>{l.weeks}</Td>
              <Td right bold>{fmt(l.total)}</Td>
            </tr>
          ))}
        </tbody>
        {lines.length > 0 && (
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200">
              <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Total Budget</td>
              <Td right bold>{fmt(total)}</Td>
            </tr>
          </tfoot>
        )}
      </TableWrap>
    </div>
  );
}

// ─── Tab: Warren's Weekly P&L ────────────────────────────────────────────────

function TabWeeklyPL({ rows }: { rows: PLRow[] }) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>Week Ending</Th>
          <Th right>Margin from Recharged Costs</Th>
          <Th right>Warren&apos;s Salary</Th>
          <Th right>Weekly Profit</Th>
          <Th right>Running Total Profit</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? <EmptyRow cols={5} label="No P&L data yet" /> : rows.map((r, i) => {
          const profitPos = r.weekly_profit >= 0;
          const runPos    = r.running_total_profit >= 0;
          return (
            <tr key={i} className="hover:bg-slate-50/50">
              <Td bold>{fmtDate(r.week_ending_date)}</Td>
              <Td right>{fmt(r.margin_from_recharged_costs)}</Td>
              <Td right>{fmt(r.warrens_salary)}</Td>
              <Td right>
                <span className={`flex items-center justify-end gap-1 font-semibold ${profitPos ? 'text-green-700' : 'text-red-600'}`}>
                  {profitPos ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {fmt(r.weekly_profit)}
                </span>
              </Td>
              <Td right>
                <span className={`font-bold text-base ${runPos ? 'text-green-700' : 'text-red-600'}`}>
                  {fmt(r.running_total_profit)}
                </span>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}

// ─── Tab: Omitted Entries ─────────────────────────────────────────────────────

function TabOmitted({ rows }: { rows: Type2Report['omitted_entries'] }) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>Entry ID</Th>
          <Th>Reason</Th>
          <Th>Flagged At</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0
          ? <EmptyRow cols={3} label="No omitted entries" />
          : rows.map(r => (
            <tr key={r.id} className="hover:bg-slate-50/50">
              <Td><span className="font-mono text-xs">{r.entry_id}</span></Td>
              <Td>{r.omit_reason ?? <span className="italic text-slate-400">No reason given</span>}</Td>
              <Td>{r.created_at ? fmtDate(r.created_at) : '—'}</Td>
            </tr>
          ))
        }
      </tbody>
    </TableWrap>
  );
}

// ─── Tab: Margins Reference ───────────────────────────────────────────────────

const DEFAULT_MARGIN_ITEMS = [
  "Employers liability insurance", "Public liability insurance",
  "Professional indemnity insurance", "NI contributions",
  "PAYE contributions", "Vehicle insurance", "Legal fees",
  "Car allowances", "Training", "Software", "Professional memberships",
  "Telephone", "Payroll accountancy",
];

function TabMargins({ marginsRef }: { marginsRef: Type2Report['margins_reference'] }) {
  const items = (marginsRef?.items?.length ? marginsRef.items : DEFAULT_MARGIN_ITEMS) as string[];
  const notes = marginsRef?.notes;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div>
        <h3 className="text-slate-900 font-semibold text-sm">What the Margin Covers</h3>
        <p className="text-slate-400 text-xs mt-0.5">Static reference — editable by MD only</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
            <span className="text-slate-700 text-xs">{item}</span>
          </div>
        ))}
      </div>
      {notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-amber-800 text-xs">{notes}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CostReportType2({ report }: { report: Type2Report }) {
  const [activeTab, setActiveTab] = useState<TabId>('main');

  return (
    <div className="space-y-4">
      <SummaryBanner summary={report.summary} />

      {/* Tab bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 overflow-x-auto">
          <div className="flex min-w-max">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 md:p-5">
          {activeTab === 'main'      && <TabMainCostReport rows={report.main_cost_report} />}
          {activeTab === 'pos'       && <TabPOsBilling rows={report.pos_and_billing} />}
          {activeTab === 'labour'    && <TabLabour rows={report.labour_to_send} />}
          {activeTab === 'materials' && <TabMaterials rows={report.materials_to_send} />}
          {activeTab === 'weekly'    && <TabWeeklyInvoice rows={report.weekly_invoice_summary} />}
          {activeTab === 'budget'    && <TabMasterBudget budget={report.budget} />}
          {activeTab === 'pl'        && <TabWeeklyPL rows={report.weekly_pl} />}
          {activeTab === 'omitted'   && <TabOmitted rows={report.omitted_entries} />}
          {activeTab === 'margins'   && <TabMargins marginsRef={report.margins_reference} />}
        </div>
      </div>
    </div>
  );
}
