const db = require('../config/db');
const csvParse = require('csv-parse/sync');
const { recordSupplierCost } = require('../services/costReportService');

// Allowed Payment Methods
const ALLOWED_PMT_METHODS = new Set([
  'supplier_account',
  'arbuthnot_current_account',
  'charge_card',
  'pleo_charge_card'
]);

// Allowed Statuses
const ALLOWED_STATUSES = new Set([
  'draft',
  'issued',
  'pending_approval',
  'approved'
]);

const CSV_HEADERS = [
  'PO Number',
  'Date',
  'Supplier Name',
  'Supplier Email',
  'Street Name',
  'Zip Code',
  'City',
  'County',
  'Production Name',
  'Set Code',
  'Account Code',
  'Description',
  'Department',
  'Net Amount',
  'VAT',
  'Gross Amount',
  'Payment Method',
  'Status'
];

const DEMO_ROW = [
  'PO-9999',
  '2026-06-27',
  'Scenic Arts Ltd',
  'info@scenicarts.com',
  '12 Studio Lane',
  'M1 2AB',
  'Manchester',
  'Greater Manchester',
  'Demo Production',
  'S001',
  'MAT-001',
  'Scenic paints and brushes',
  'Scenic Art',
  '500.00',
  '100.00',
  '600.00',
  'supplier_account',
  'approved'
];

// Helper: auto-generate unique PO number
const generatePoNumber = async (client) => {
  const { rows } = await client.query(
    `SELECT MAX(CAST(SUBSTRING(po_number FROM 4) AS INTEGER)) AS max_num
     FROM purchase_orders
     WHERE po_number ~ '^PO-[0-9]+$'`
  );
  const max = parseInt(rows[0]?.max_num, 10) || 0;
  return `PO-${String(max + 1).padStart(4, '0')}`;
};

// GET /api/purchase-orders/import/template
const getImportTemplate = (req, res) => {
  const template = [CSV_HEADERS.join(','), DEMO_ROW.join(',')].join('\r\n') + '\r\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="purchase_orders_import_template.csv"');
  res.send(template);
};

// POST /api/purchase-orders/import
const importCSV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file provided' });
  }

  let records;
  try {
    records = csvParse.parse(req.file.buffer.toString(), {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  } catch (err) {
    return res.status(400).json({ error: `CSV parse error: ${err.message}` });
  }

  if (records.length === 0) {
    return res.status(400).json({ error: 'CSV is empty' });
  }

  const imported = [];
  const skipped = [];

  for (let idx = 0; idx < records.length; idx++) {
    const row = records[idx];
    const rowNum = idx + 2; // header is row 1
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // 1. Validate Supplier Name
      const supplierName = row['Supplier Name']?.trim();
      if (!supplierName) {
        throw new Error('Supplier Name is required');
      }

      // 2. Validate Production Name
      const prodName = row['Production Name']?.trim();
      if (!prodName) {
        throw new Error('Production Name is required');
      }

      const { rows: prodRows } = await client.query(
        `SELECT id, status FROM productions WHERE LOWER(name) = LOWER($1)`,
        [prodName]
      );
      if (prodRows.length === 0) {
        throw new Error(`Production "${prodName}" not found`);
      }
      const prod = prodRows[0];
      if (prod.status === 'archived') {
        throw new Error(`Production "${prodName}" is archived`);
      }

      // 3. Validate Date
      const dateStr = row['Date']?.trim();
      if (!dateStr) {
        throw new Error('Date is required');
      }
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateStr)) {
        throw new Error('Date must be in YYYY-MM-DD format');
      }
      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        throw new Error('Date is invalid');
      }

      // 4. Validate Net Amount
      const netStr = row['Net Amount']?.trim();
      if (!netStr) {
        throw new Error('Net Amount is required');
      }
      const netAmount = parseFloat(netStr);
      if (isNaN(netAmount) || netAmount < 0) {
        throw new Error('Net Amount must be a non-negative number');
      }

      // 5. VAT & Gross Amount
      const vatStr = row['VAT']?.trim();
      const vat = vatStr ? parseFloat(vatStr) : Math.round(netAmount * 0.20 * 100) / 100;
      if (isNaN(vat) || vat < 0) {
        throw new Error('VAT must be a non-negative number');
      }

      const grossStr = row['Gross Amount']?.trim();
      const grossAmount = grossStr ? parseFloat(grossStr) : Math.round((netAmount + vat) * 100) / 100;
      if (isNaN(grossAmount) || grossAmount < 0) {
        throw new Error('Gross Amount must be a non-negative number');
      }

      // 6. Payment Method normalization
      let paidFrom = row['Payment Method']?.trim().toLowerCase().replace(/\s+/g, '_') || null;
      if (paidFrom && !ALLOWED_PMT_METHODS.has(paidFrom)) {
        throw new Error(`Invalid Payment Method: must be one of ${[...ALLOWED_PMT_METHODS].join(', ')}`);
      }

      // 7. Status normalization
      let status = row['Status']?.trim().toLowerCase().replace(/\s+/g, '_') || 'approved';
      if (!ALLOWED_STATUSES.has(status)) {
        throw new Error(`Invalid Status: must be one of ${[...ALLOWED_STATUSES].join(', ')}`);
      }

      // 8. PO Number uniqueness and generation
      let poNumber = row['PO Number']?.trim();
      if (poNumber) {
        const { rows: poCheck } = await client.query(
          `SELECT 1 FROM purchase_orders WHERE po_number = $1`,
          [poNumber]
        );
        if (poCheck.length > 0) {
          throw new Error(`Duplicate PO Number: "${poNumber}" already exists`);
        }
      } else {
        poNumber = await generatePoNumber(client);
      }

      // 9. Nullable fields mapping
      const supplierEmail = row['Supplier Email']?.trim() || null;
      const streetName = row['Street Name']?.trim() || null;
      const zipCode = row['Zip Code']?.trim() || null;
      const city = row['City']?.trim() || null;
      const county = row['County']?.trim() || null;
      const setCode = row['Set Code']?.trim() || null;
      const accountCode = row['Account Code']?.trim() || null;
      const description = row['Description']?.trim() || null;
      const department = row['Department']?.trim() || null;

      // 10. Insert
      const { rows: [newPO] } = await client.query(
        `INSERT INTO purchase_orders
           (po_number, supplier_name, supplier_email, supplier_address,
            street_name, zip_code, city, county,
            date_of_po, production_id,
            set_code, account_code, description, department, net_amount, vat, gross_amount, paid_from,
            status, created_by)
         VALUES ($1,$2,$3,null,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING *`,
        [
          poNumber, supplierName, supplierEmail,
          streetName, zipCode, city, county,
          dateStr, prod.id,
          setCode, accountCode, description, department, netAmount, vat, grossAmount, paidFrom,
          status, req.user?.id || null
        ]
      );

      // 11. Feed cost into Cost Report if status is approved
      if (status === 'approved') {
        await recordSupplierCost(newPO, client);
      }

      await client.query('COMMIT');
      imported.push({ row: rowNum, po_number: newPO.po_number });
    } catch (err) {
      await client.query('ROLLBACK');
      skipped.push({
        row: rowNum,
        data: row,
        error: err.message
      });
    } finally {
      client.release();
    }
  }

  res.json({
    total_rows: records.length,
    imported_count: imported.length,
    skipped_count: skipped.length,
    errors: skipped
  });
};

module.exports = {
  getImportTemplate,
  importCSV
};
