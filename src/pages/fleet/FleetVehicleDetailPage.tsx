import type { FC } from 'hono/jsx';

interface ReminderStatus {
  category: 'oil_change' | 'tire_rotation' | 'inspection';
  label: string;
  lastServiceDate: string | null;
  lastServiceOdometer: number | null;
  currentOdometer: number | null;
  dueAtDate: string | null;
  dueAtOdometer: number | null;
  milesRemaining: number | null;
  daysRemaining: number | null;
  isDue: boolean;
  reason: string;
}

interface FleetVehicleDetailPageProps {
  vehicle: {
    id: number;
    display_name: string;
    unit_number: string | null;
    year: number | null;
    make: string | null;
    model: string | null;
    license_plate: string | null;
    vin: string | null;
    active: number;
    notes: string | null;
    archived_at: string | null;
  };
  summary: {
    totalSpend: number;
    fuelSpend: number;
    maintenanceSpend: number;
    fuelRecordCount: number;
    maintenanceRecordCount: number;
    activeRecordCount: number;
    archivedRecordCount: number;
    latestEntryDate: string | null;
    latestOdometer: number | null;
    fuelGallons: number;
    avgFuelCostPerGallon: number | null;
  };
  recentEntries: Array<{
    id: number;
    vehicle_id: number;
    entry_type: 'fuel' | 'maintenance';
    entry_date: string;
    vendor: string | null;
    amount: number;
    odometer: number | null;
    gallons: number | null;
    service_type: string | null;
    maintenance_category: string | null;
    notes: string | null;
    receipt_filename: string | null;
    archived_at: string | null;
  }>;
  reminders: ReminderStatus[];
  csrfToken: string;
  canManage: boolean;
  getCategoryLabel: (value: string | null) => string;
}

function fmtMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export const FleetVehicleDetailPage: FC<FleetVehicleDetailPageProps> = ({
  vehicle,
  summary,
  recentEntries,
  reminders,
  csrfToken,
  canManage,
  getCategoryLabel,
}) => {
  const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'No year / make / model';
  return (
    <div>
      <style>{`
        .crumbs{display:flex;gap:8px;align-items:center;margin-bottom:14px;color:var(--muted);font-size:13px}.crumbs a{font-weight:700}
        .hero{background:#fff;border:1px solid var(--border);border-radius:16px;padding:18px;box-shadow:var(--shadow);margin-bottom:14px}
        .hero-grid{display:grid;grid-template-columns:2fr 1fr;gap:14px}
        .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:14px}
        .stat,.card{background:#fff;border:1px solid var(--border);border-radius:16px;padding:16px;box-shadow:var(--shadow)}
        .label{font-size:12px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.04em}.value{font-size:24px;font-weight:800;margin-top:8px}
        .small-value{font-size:18px;font-weight:800;margin-top:8px}
        .meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.meta-item{padding:12px;border:1px solid var(--border);border-radius:12px;background:#f8fafc}.meta-item b{display:block;margin-bottom:6px;font-size:12px;text-transform:uppercase;color:var(--muted)}
        .actions{display:flex;gap:8px;flex-wrap:wrap}.btn{display:inline-flex;align-items:center;justify-content:center;padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:#fff;color:var(--text);font-weight:700;text-decoration:none;cursor:pointer}.badge{display:inline-block;padding:5px 8px;border-radius:999px;background:#eef2ff;font-size:12px;font-weight:700}.badge-good{background:#ecfdf3;color:#166534}.badge-warn{background:#fff7ed;color:#9a3412}.badge-danger{background:#FEF2F2;color:#991B1B}.table-wrap{overflow:auto}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:12px;border-top:1px solid var(--border);vertical-align:top}.table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);text-align:left}.right{text-align:right}.muted{color:var(--muted)}.small{font-size:12px}
        .reminders{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:14px}.reminder{border:1px solid var(--border);border-radius:16px;padding:16px;background:#fff;box-shadow:var(--shadow)}
        @media (max-width:1100px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.hero-grid,.meta,.reminders{grid-template-columns:1fr}}
        @media (max-width:700px){.stats{grid-template-columns:1fr}}
      `}</style>

      <div class="crumbs"><a href="/fleet">Fleet</a><span>›</span><span>{vehicle.display_name}</span></div>

      <div class="hero">
        <div class="hero-grid">
          <div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <h1 style="margin:0;font-size:28px;line-height:1.1;">{vehicle.display_name}</h1>
              {vehicle.archived_at ? <span class="badge">Archived</span> : vehicle.active ? <span class="badge badge-good">Active</span> : <span class="badge badge-warn">Inactive</span>}
            </div>
            <div class="muted" style="margin-top:8px;">{vehicleLabel}</div>
            {vehicle.notes ? <div style="margin-top:12px;">{vehicle.notes}</div> : null}
          </div>
          <div>
            <div class="actions" style="justify-content:flex-end;">
              <a class="btn" href={`/fleet?vehicleId=${vehicle.id}`}>Add Record</a>
              {canManage ? <a class="btn" href={`/fleet?editVehicle=${vehicle.id}`}>Edit Vehicle</a> : null}
              <a class="btn" href="/fleet">Back to Fleet</a>
            </div>
          </div>
        </div>
      </div>

      <div class="reminders">
        {reminders.map((reminder) => (
          <div class="reminder">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <b>{reminder.label}</b>
              <span class={reminder.isDue ? 'badge badge-danger' : 'badge badge-good'}>{reminder.isDue ? 'Due' : 'On Track'}</span>
            </div>
            <div class="muted small" style="margin-top:8px;">{reminder.reason}</div>
            <div class="meta" style="margin-top:12px;">
              <div class="meta-item"><b>Last Service</b>{reminder.lastServiceDate || '—'}</div>
              <div class="meta-item"><b>Last Odometer</b>{reminder.lastServiceOdometer ?? '—'}</div>
              <div class="meta-item"><b>Due Date</b>{reminder.dueAtDate || '—'}</div>
              <div class="meta-item"><b>Due Mileage</b>{reminder.dueAtOdometer ?? '—'}</div>
            </div>
          </div>
        ))}
      </div>

      <div class="stats">
        <div class="stat"><div class="label">Lifetime Spend</div><div class="value">{fmtMoney(summary.totalSpend)}</div></div>
        <div class="stat"><div class="label">Fuel Spend</div><div class="value">{fmtMoney(summary.fuelSpend)}</div></div>
        <div class="stat"><div class="label">Maintenance Spend</div><div class="value">{fmtMoney(summary.maintenanceSpend)}</div></div>
        <div class="stat"><div class="label">Latest Odometer</div><div class="value">{summary.latestOdometer ?? '—'}</div></div>
      </div>

      <div class="stats">
        <div class="stat"><div class="label">Fuel Records</div><div class="small-value">{summary.fuelRecordCount}</div></div>
        <div class="stat"><div class="label">Maintenance Records</div><div class="small-value">{summary.maintenanceRecordCount}</div></div>
        <div class="stat"><div class="label">Fuel Gallons</div><div class="small-value">{summary.fuelGallons ? summary.fuelGallons.toFixed(3) : '0.000'}</div></div>
        <div class="stat"><div class="label">Avg Fuel Cost / Gallon</div><div class="small-value">{summary.avgFuelCostPerGallon === null ? '—' : `$${summary.avgFuelCostPerGallon.toFixed(3)}`}</div></div>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <div style="display:grid;grid-template-columns:1.2fr .8fr;gap:14px;">
          <div class="meta">
            <div class="meta-item"><b>Unit Number</b>{vehicle.unit_number || '—'}</div>
            <div class="meta-item"><b>License Plate</b>{vehicle.license_plate || '—'}</div>
            <div class="meta-item"><b>VIN</b>{vehicle.vin || '—'}</div>
            <div class="meta-item"><b>Latest Entry Date</b>{summary.latestEntryDate || '—'}</div>
          </div>
          <div class="meta">
            <div class="meta-item"><b>Active Records</b>{summary.activeRecordCount}</div>
            <div class="meta-item"><b>Archived Records</b>{summary.archivedRecordCount}</div>
            <div class="meta-item"><b>Fuel Share</b>{summary.totalSpend > 0 ? `${((summary.fuelSpend / summary.totalSpend) * 100).toFixed(1)}%` : '0.0%'}</div>
            <div class="meta-item"><b>Maintenance Share</b>{summary.totalSpend > 0 ? `${((summary.maintenanceSpend / summary.totalSpend) * 100).toFixed(1)}%` : '0.0%'}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;">
          <b>Recent Activity</b>
          <span class="badge">{recentEntries.length} records shown</span>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Date / Type</th><th>Vendor / Detail</th><th class="right">Amount</th><th>Status</th><th class="right">Actions</th></tr></thead>
            <tbody>
              {recentEntries.length > 0 ? recentEntries.map((entry) => (
                <tr>
                  <td><div><b>{entry.entry_date}</b></div><div class="muted small" style="margin-top:4px;text-transform:capitalize;">{entry.entry_type}</div></td>
                  <td>
                    <div>{entry.vendor || 'No vendor listed'}</div>
                    <div class="muted small" style="margin-top:4px;">
                      Odometer: {entry.odometer ?? '—'}
                      {entry.entry_type === 'fuel' ? ` • Gallons: ${entry.gallons ?? '—'}` : ''}
                      {entry.entry_type === 'maintenance' ? ` • Service: ${entry.service_type || '—'} • Category: ${getCategoryLabel(entry.maintenance_category)}` : ''}
                    </div>
                    {entry.notes ? <div class="muted small" style="margin-top:4px;">{entry.notes}</div> : null}
                  </td>
                  <td class="right"><b>{fmtMoney(entry.amount)}</b></td>
                  <td>{entry.archived_at ? <span class="badge">Archived</span> : <span class="badge badge-good">Active</span>}</td>
                  <td class="right">
                    <div class="actions" style="justify-content:flex-end;">
                      {entry.receipt_filename ? <a class="btn" href={`/fleet/entries/${entry.id}/receipt`}>Receipt</a> : null}
                      {canManage && !entry.archived_at ? <a class="btn" href={`/fleet?editEntry=${entry.id}`}>Edit</a> : null}
                      {canManage && !entry.archived_at ? <form method="post" action={`/fleet/entries/${entry.id}/archive`}><input type="hidden" name="csrf_token" value={csrfToken} /><button class="btn" type="submit">Archive</button></form> : null}
                      {canManage && entry.archived_at ? <form method="post" action={`/fleet/entries/${entry.id}/restore`}><input type="hidden" name="csrf_token" value={csrfToken} /><button class="btn" type="submit">Restore</button></form> : null}
                    </div>
                  </td>
                </tr>
              )) : <tr><td colspan={5} class="muted">No fleet records added for this vehicle yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FleetVehicleDetailPage;
