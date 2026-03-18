import type { FC } from 'hono/jsx';
import type { AdvancedReportsData, ProfitabilityRow } from '../../services/reporting.js';

interface ReportsPrintPageProps extends AdvancedReportsData {
  tenantName: string;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatPercent(value: number): string {
  return `${(value || 0).toFixed(1)}%`;
}

function RankingRows({
  rows,
  valueSelector,
  secondarySelector,
}: {
  rows: ProfitabilityRow[];
  valueSelector: (row: ProfitabilityRow) => string;
  secondarySelector: (row: ProfitabilityRow) => string;
}) {
  return (
    <table class="print-table">
      <thead>
        <tr>
          <th>Job</th>
          <th>Client</th>
          <th class="right">Primary</th>
          <th class="right">Secondary</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={4}>No jobs found.</td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr>
              <td>{row.job_name || `Job #${row.id}`}</td>
              <td>{row.client || '—'}</td>
              <td class="right">{valueSelector(row)}</td>
              <td class="right">{secondarySelector(row)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export const ReportsPrintPage: FC<ReportsPrintPageProps> = ({
  tenantName,
  filter,
  cash,
  aging,
  expenseCategories,
  rows,
  topProfitJobs,
  worstProfitJobs,
  topMarginJobs,
  worstMarginJobs,
}) => {
  const generatedAt = new Date().toLocaleString();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{tenantName} Reports</title>
        <style>{`
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            background: #ffffff;
          }
          .print-shell {
            max-width: 1100px;
            margin: 0 auto;
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
            margin-bottom: 24px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 16px;
          }
          .print-title {
            margin: 0;
            font-size: 28px;
          }
          .muted {
            color: #6b7280;
          }
          .print-grid {
            display: grid;
            gap: 12px;
          }
          .print-grid-4 {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .print-grid-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .print-card {
            border: 1px solid #d1d5db;
            border-radius: 10px;
            padding: 12px;
            break-inside: avoid;
          }
          .label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #6b7280;
          }
          .value {
            font-size: 24px;
            font-weight: 700;
            margin-top: 6px;
          }
          .section {
            margin-top: 18px;
          }
          .section h2 {
            margin: 0 0 10px;
            font-size: 18px;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          .print-table th,
          .print-table td {
            border: 1px solid #d1d5db;
            padding: 8px;
            vertical-align: top;
          }
          .print-table th {
            background: #f9fafb;
            text-align: left;
          }
          .right {
            text-align: right;
          }
          @media print {
            body { padding: 0; }
            .print-shell { max-width: 100%; }
          }
        `}</style>
      </head>
      <body>
        <div class="print-shell">
          <div class="print-header">
            <div>
              <h1 class="print-title">Advanced Reports</h1>
              <div>{tenantName}</div>
              <div class="muted">{filter.label}</div>
            </div>
            <div class="muted">
              Generated: {generatedAt}
            </div>
          </div>

          <div class="print-grid print-grid-4">
            <div class="print-card">
              <div class="label">Recorded Income</div>
              <div class="value">{formatMoney(cash.recordedIncome)}</div>
            </div>
            <div class="print-card">
              <div class="label">Collected Payments</div>
              <div class="value">{formatMoney(cash.collectedPayments)}</div>
            </div>
            <div class="print-card">
              <div class="label">Cash Outflow</div>
              <div class="value">{formatMoney(cash.cashOutflow)}</div>
            </div>
            <div class="print-card">
              <div class="label">Net Cash</div>
              <div class="value">{formatMoney(cash.netCash)}</div>
            </div>
          </div>

          <div class="section">
            <h2>Invoice Aging</h2>
            <div class="print-grid print-grid-4">
              <div class="print-card">
                <div class="label">Current</div>
                <div class="value">{formatMoney(aging.current)}</div>
              </div>
              <div class="print-card">
                <div class="label">1-30 Days</div>
                <div class="value">{formatMoney(aging.days1to30)}</div>
              </div>
              <div class="print-card">
                <div class="label">31-60 Days</div>
                <div class="value">{formatMoney(aging.days31to60)}</div>
              </div>
              <div class="print-card">
                <div class="label">61-90 Days</div>
                <div class="value">{formatMoney(aging.days61to90)}</div>
              </div>
            </div>
            <div class="print-grid print-grid-2" style="margin-top: 12px;">
              <div class="print-card">
                <div class="label">90+ Days</div>
                <div class="value">{formatMoney(aging.days90Plus)}</div>
              </div>
              <div class="print-card">
                <div class="label">Total Open A/R</div>
                <div class="value">{formatMoney(aging.totalOpen)}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Expense Categories</h2>
            <table class="print-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th class="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenseCategories.length === 0 ? (
                  <tr>
                    <td colSpan={2}>No expense category data found.</td>
                  </tr>
                ) : (
                  expenseCategories.map((item) => (
                    <tr>
                      <td>{item.label}</td>
                      <td class="right">{formatMoney(item.value)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>Top Profit Jobs</h2>
            <RankingRows
              rows={topProfitJobs}
              valueSelector={(row) => formatMoney(row.profit)}
              secondarySelector={(row) => formatPercent(row.margin)}
            />
          </div>

          <div class="section">
            <h2>Worst Profit Jobs</h2>
            <RankingRows
              rows={worstProfitJobs}
              valueSelector={(row) => formatMoney(row.profit)}
              secondarySelector={(row) => formatPercent(row.margin)}
            />
          </div>

          <div class="section">
            <h2>Best Margin Jobs</h2>
            <RankingRows
              rows={topMarginJobs}
              valueSelector={(row) => formatPercent(row.margin)}
              secondarySelector={(row) => formatMoney(row.profit)}
            />
          </div>

          <div class="section">
            <h2>Lowest Margin Jobs</h2>
            <RankingRows
              rows={worstMarginJobs}
              valueSelector={(row) => formatPercent(row.margin)}
              secondarySelector={(row) => formatMoney(row.profit)}
            />
          </div>

          <div class="section">
            <h2>Job Profitability Summary</h2>
            <table class="print-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th class="right">Contract</th>
                  <th class="right">Income</th>
                  <th class="right">Invoiced</th>
                  <th class="right">Collected</th>
                  <th class="right">Expenses</th>
                  <th class="right">Labor</th>
                  <th class="right">Total Cost</th>
                  <th class="right">Profit</th>
                  <th class="right">Margin</th>
                  <th class="right">Open A/R</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={13}>No jobs found.</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr>
                      <td>{row.job_name || `Job #${row.id}`}</td>
                      <td>{row.client || '—'}</td>
                      <td>{row.archived ? 'Archived' : row.status}</td>
                      <td class="right">{formatMoney(row.contract)}</td>
                      <td class="right">{formatMoney(row.income)}</td>
                      <td class="right">{formatMoney(row.invoiced)}</td>
                      <td class="right">{formatMoney(row.collected)}</td>
                      <td class="right">{formatMoney(row.expenses)}</td>
                      <td class="right">{formatMoney(row.labor)}</td>
                      <td class="right">{formatMoney(row.totalCost)}</td>
                      <td class="right">{formatMoney(row.profit)}</td>
                      <td class="right">{formatPercent(row.margin)}</td>
                      <td class="right">{formatMoney(row.openAr)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </body>
    </html>
  );
};

export default ReportsPrintPage;