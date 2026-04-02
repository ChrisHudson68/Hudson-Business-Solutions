import type { FC } from 'hono/jsx';

interface FleetPacketPageProps {
  vehicle: {
    id: number;
    display_name: string;
    unit_number: string | null;
    year: number | null;
    make: string | null;
    model: string | null;
    license_plate: string | null;
    vin: string | null;
    assigned_employee_name: string | null;
    assigned_driver_name: string | null;
    notes: string | null;
  };
  summary: {
    totalSpend: number;
    fuelSpend: number;
    maintenanceSpend: number;
    latestEntryDate: string | null;
    latestOdometer: number | null;
    fuelGallons: number;
    avgFuelCostPerGallon: number | null;
  };
  reminders: Array<{
    label: string;
    dueAtDate: string | null;
    dueAtOdometer: number | null;
    isDue: boolean;
    reason: string;
  }>;
  documents: Array<{
    id: number;
    document_type: string;
    title: string;
    expiration_date: string | null;
    archived_at: string | null;
  }>;
  recentEntries: Array<{
    id: number;
    entry_type: 'fuel' | 'maintenance';
    entry_date: string;
    vendor: string | null;
    amount: number;
    odometer: number | null;
    gallons: number | null;
    service_type: string | null;
    maintenance_category: string | null;
  }>;
  getCategoryLabel: (value: string | null) => string;
  getDocumentTypeLabel: (value: string | null) => string;
}

function fmtMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

export const FleetPacketPage: FC<FleetPacketPageProps> = ({ vehicle, summary, reminders, documents, recentEntries, getCategoryLabel, getDocumentTypeLabel }) => {
  const assignedDriverLabel = vehicle.assigned_employee_name || vehicle.assigned_driver_name || 'Unassigned';
  return (
    <div>
      <style>{`
        .packet{max-width:1000px;margin:0 auto;padding:24px}.section{margin-top:20px;background:#fff;border:1px solid var(--border);border-radius:16px;padding:16px}.head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:10px;border-top:1px solid var(--border);text-align:left;vertical-align:top}.table th{font-size:12px;text-transform:uppercase;color:var(--muted)}.muted{color:var(--muted)}.badge{display:inline-block;padding:5px 8px;border-radius:999px;background:#eef2ff;font-size:12px;font-weight:700}.badge-danger{background:#FEF2F2;color:#991B1B}.btn{display:inline-flex;align-items:center;justify-content:center;padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:#fff;color:var(--text);font-weight:700;text-decoration:none;cursor:pointer}
        @media print {.print-actions{display:none}.packet{padding:0}.section{break-inside:avoid;box-shadow:none}}
      `}</style>
      <div class="packet">
        <div class="print-actions" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;">
          <a class="btn" href={`/fleet/vehicles/${vehicle.id}`}>Back to Vehicle</a>
          <button class="btn" type="button" onclick="window.print()">Print / Save PDF</button>
        </div>

        <div class="section">
          <div class="head">
            <div>
              <h1 style="margin:0;">{vehicle.display_name} Fleet Packet</h1>
              <div class="muted" style="margin-top:8px;">{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'No year / make / model'}</div>
            </div>
            <div class="muted">Generated packet</div>
          </div>
          <div class="grid" style="margin-top:16px;">
            <div><b>Unit Number</b><div>{vehicle.unit_number || '—'}</div></div>
            <div><b>License Plate</b><div>{vehicle.license_plate || '—'}</div></div>
            <div><b>VIN</b><div>{vehicle.vin || '—'}</div></div>
            <div><b>Assigned Driver</b><div>{assignedDriverLabel}</div></div>
            <div><b>Latest Entry Date</b><div>{summary.latestEntryDate || '—'}</div></div>
            <div><b>Latest Odometer</b><div>{summary.latestOdometer ?? '—'}</div></div>
          </div>
          {vehicle.notes ? <div style="margin-top:16px;"><b>Notes</b><div>{vehicle.notes}</div></div> : null}
        </div>

        <div class="section">
          <h2 style="margin-top:0;">Cost Snapshot</h2>
          <div class="grid">
            <div><b>Total Spend</b><div>{fmtMoney(summary.totalSpend)}</div></div>
            <div><b>Fuel Spend</b><div>{fmtMoney(summary.fuelSpend)}</div></div>
            <div><b>Maintenance Spend</b><div>{fmtMoney(summary.maintenanceSpend)}</div></div>
            <div><b>Fuel Gallons</b><div>{summary.fuelGallons.toFixed(3)}</div></div>
            <div><b>Avg Fuel Cost / Gallon</b><div>{summary.avgFuelCostPerGallon === null ? '—' : `$${summary.avgFuelCostPerGallon.toFixed(3)}`}</div></div>
            <div><b>Output</b><div>Use browser print to save as PDF.</div></div>
          </div>
        </div>

        <div class="section">
          <h2 style="margin-top:0;">Service Reminders</h2>
          {reminders.length > 0 ? reminders.map((reminder) => (
            <div style="padding:10px 0;border-top:1px solid var(--border);">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
                <b>{reminder.label}</b>
                <span class={reminder.isDue ? 'badge badge-danger' : 'badge'}>{reminder.isDue ? 'Due' : 'On Track'}</span>
              </div>
              <div class="muted" style="margin-top:4px;">{reminder.reason}</div>
              <div class="muted" style="margin-top:4px;">Due date: {reminder.dueAtDate || '—'} • Due mileage: {reminder.dueAtOdometer ?? '—'}</div>
            </div>
          )) : <div class="muted">No reminder data yet.</div>}
        </div>

        <div class="section">
          <h2 style="margin-top:0;">Documents</h2>
          <table class="table">
            <thead><tr><th>Title</th><th>Type</th><th>Expiration</th><th>Status</th></tr></thead>
            <tbody>
              {documents.length > 0 ? documents.map((document) => (
                <tr>
                  <td>{document.title}</td>
                  <td>{getDocumentTypeLabel(document.document_type)}</td>
                  <td>{document.expiration_date || '—'}</td>
                  <td>{document.archived_at ? 'Archived' : 'Active'}</td>
                </tr>
              )) : <tr><td colSpan={4} class="muted">No fleet documents uploaded.</td></tr>}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2 style="margin-top:0;">Recent Activity</h2>
          <table class="table">
            <thead><tr><th>Date</th><th>Type</th><th>Vendor / Detail</th><th>Odometer</th><th>Amount</th></tr></thead>
            <tbody>
              {recentEntries.length > 0 ? recentEntries.map((entry) => (
                <tr>
                  <td>{entry.entry_date}</td>
                  <td style="text-transform:capitalize;">{entry.entry_type}</td>
                  <td>
                    <div>{entry.vendor || 'No vendor listed'}</div>
                    <div class="muted">{entry.entry_type === 'fuel' ? `Gallons: ${entry.gallons ?? '—'}` : `Service: ${entry.service_type || '—'} • Category: ${getCategoryLabel(entry.maintenance_category)}`}</div>
                  </td>
                  <td>{entry.odometer ?? '—'}</td>
                  <td>{fmtMoney(entry.amount)}</td>
                </tr>
              )) : <tr><td colSpan={5} class="muted">No activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FleetPacketPage;
