import type { FC } from 'hono/jsx';

interface FleetPageProps {
  vehicles: Array<{
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
  }>;
  entries: Array<{
    id: number;
    vehicle_id: number;
    vehicle_display_name: string;
    vehicle_unit_number: string | null;
    entry_type: 'fuel' | 'maintenance';
    entry_date: string;
    vendor: string | null;
    amount: number;
    odometer: number | null;
    gallons: number | null;
    service_type: string | null;
    notes: string | null;
    receipt_filename: string | null;
    archived_at: string | null;
  }>;
  vehicleFormData: {
    display_name: string;
    unit_number: string;
    year: string;
    make: string;
    model: string;
    license_plate: string;
    vin: string;
    active: string;
    notes: string;
  };
  recordFormData: {
    vehicle_id: string;
    entry_type: string;
    entry_date: string;
    vendor: string;
    amount: string;
    odometer: string;
    gallons: string;
    service_type: string;
    notes: string;
    remove_receipt: string;
  };
  editingVehicleId?: number | null;
  editingEntryId?: number | null;
  error?: string;
  success?: string;
  csrfToken: string;
  canManage: boolean;
  summary: {
    activeVehicles: number;
    archivedVehicles: number;
    fuelMtd: number;
    maintenanceMtd: number;
    activeRecords: number;
    archivedRecords: number;
  };
}

function fmtMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function vehicleSubtitle(vehicle: FleetPageProps['vehicles'][number]): string {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'No year / make / model';
}

export const FleetPage: FC<FleetPageProps> = ({
  vehicles,
  entries,
  vehicleFormData,
  recordFormData,
  editingVehicleId,
  editingEntryId,
  error,
  success,
  csrfToken,
  canManage,
  summary,
}) => {
  const editingVehicle = editingVehicleId ? vehicles.find((v) => v.id === editingVehicleId) : null;
  const editingEntry = editingEntryId ? entries.find((entry) => entry.id === editingEntryId) : null;
  const isEditingVehicle = !!editingVehicle;
  const isEditingEntry = !!editingEntry;

  return (
    <div>
      <style>{`
        .fleet-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:14px}
        .fleet-stat{background:#fff;border:1px solid var(--border);border-radius:16px;padding:16px;box-shadow:var(--shadow)}
        .fleet-stat .label{font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em}
        .fleet-stat .value{font-size:26px;font-weight:800;margin-top:8px}
        .card{background:#fff;border:1px solid var(--border);border-radius:16px;padding:16px;box-shadow:var(--shadow)}
        .card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px}
        .stack{display:grid;gap:14px;margin-bottom:14px}
        .row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .row.two{grid-template-columns:repeat(2,minmax(0,1fr))}
        label{display:block;font-size:12px;font-weight:800;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
        input,select,textarea{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:12px;font:inherit;background:#fff}
        textarea{resize:vertical}
        .actions{display:flex;gap:8px;flex-wrap:wrap}
        .btn{display:inline-flex;align-items:center;justify-content:center;padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:#fff;color:var(--text);font-weight:700;text-decoration:none;cursor:pointer}
        .btn-primary{background:var(--navy);border-color:var(--navy);color:#fff}
        .table-wrap{overflow:auto}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:12px;border-top:1px solid var(--border);vertical-align:top}.table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);text-align:left}.right{text-align:right}.muted{color:var(--muted)}.small{font-size:12px}.badge{display:inline-block;padding:5px 8px;border-radius:999px;background:#eef2ff;font-size:12px;font-weight:700}.badge-good{background:#ecfdf3;color:#166534}.badge-warn{background:#fff7ed;color:#9a3412}.alert{padding:12px 14px;border-radius:12px;margin-bottom:14px;font-weight:700}.alert-good{background:#ecfdf3;color:#166534}.alert-bad{background:#fef2f2;color:#991b1b}
        @media (max-width:1100px){.fleet-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.row,.row.two{grid-template-columns:1fr}}
        @media (max-width:700px){.fleet-grid{grid-template-columns:1fr}}
      `}</style>

      {error ? <div class="alert alert-bad">{error}</div> : null}
      {success ? <div class="alert alert-good">{success}</div> : null}

      <div class="fleet-grid">
        <div class="fleet-stat"><div class="label">Active Vehicles</div><div class="value">{summary.activeVehicles}</div></div>
        <div class="fleet-stat"><div class="label">Fuel Spend MTD</div><div class="value">{fmtMoney(summary.fuelMtd)}</div></div>
        <div class="fleet-stat"><div class="label">Maintenance MTD</div><div class="value">{fmtMoney(summary.maintenanceMtd)}</div></div>
        <div class="fleet-stat"><div class="label">Active Records</div><div class="value">{summary.activeRecords}</div></div>
      </div>

      {canManage ? (
        <div class="stack" style="grid-template-columns:repeat(2,minmax(0,1fr));">
          <div class="card">
            <div class="card-head">
              <b>{isEditingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</b>
              {isEditingVehicle ? <a class="btn" href="/fleet">Cancel Edit</a> : null}
            </div>
            <form method="post" action={isEditingVehicle ? `/fleet/vehicles/${editingVehicleId}/update` : '/fleet/vehicles'}>
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <div class="row two">
                <div><label>Display Name</label><input type="text" name="display_name" value={vehicleFormData.display_name} required /></div>
                <div><label>Unit Number</label><input type="text" name="unit_number" value={vehicleFormData.unit_number} /></div>
              </div>
              <div class="row">
                <div><label>Year</label><input type="number" name="year" value={vehicleFormData.year} min="1900" max="2100" /></div>
                <div><label>Make</label><input type="text" name="make" value={vehicleFormData.make} /></div>
                <div><label>Model</label><input type="text" name="model" value={vehicleFormData.model} /></div>
              </div>
              <div class="row">
                <div><label>License Plate</label><input type="text" name="license_plate" value={vehicleFormData.license_plate} /></div>
                <div><label>VIN</label><input type="text" name="vin" value={vehicleFormData.vin} /></div>
                <div><label>Status</label><select name="active"><option value="1" selected={vehicleFormData.active !== '0'}>Active</option><option value="0" selected={vehicleFormData.active === '0'}>Inactive</option></select></div>
              </div>
              <label>Notes</label>
              <textarea name="notes" rows={3}>{vehicleFormData.notes}</textarea>
              <div class="actions" style="margin-top:14px"><button class="btn btn-primary" type="submit">{isEditingVehicle ? 'Save Vehicle' : 'Add Vehicle'}</button></div>
            </form>
          </div>

          <div class="card">
            <div class="card-head">
              <b>{isEditingEntry ? 'Edit Fleet Record' : 'Add Fleet Record'}</b>
              {isEditingEntry ? <a class="btn" href="/fleet">Cancel Edit</a> : null}
            </div>
            <form method="post" enctype="multipart/form-data" action={isEditingEntry ? `/fleet/entries/${editingEntryId}/update` : '/fleet/entries'}>
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <div class="row two">
                <div>
                  <label>Vehicle</label>
                  <select name="vehicle_id" required>
                    <option value="">Select a vehicle</option>
                    {vehicles.filter((vehicle) => !vehicle.archived_at).map((vehicle) => (
                      <option value={String(vehicle.id)} selected={recordFormData.vehicle_id === String(vehicle.id)}>{vehicle.display_name}</option>
                    ))}
                  </select>
                </div>
                <div><label>Record Type</label><select name="entry_type"><option value="fuel" selected={recordFormData.entry_type !== 'maintenance'}>Fuel</option><option value="maintenance" selected={recordFormData.entry_type === 'maintenance'}>Maintenance</option></select></div>
              </div>
              <div class="row">
                <div><label>Date</label><input type="date" name="entry_date" value={recordFormData.entry_date} required /></div>
                <div><label>Vendor</label><input type="text" name="vendor" value={recordFormData.vendor} /></div>
                <div><label>Amount</label><input type="number" name="amount" value={recordFormData.amount} min="0.01" step="0.01" required /></div>
              </div>
              <div class="row">
                <div><label>Odometer</label><input type="number" name="odometer" value={recordFormData.odometer} min="0" step="1" /></div>
                <div><label>Gallons</label><input type="number" name="gallons" value={recordFormData.gallons} min="0" step="0.001" /></div>
                <div><label>Service Type</label><input type="text" name="service_type" value={recordFormData.service_type} /></div>
              </div>
              <label>Notes</label>
              <textarea name="notes" rows={3}>{recordFormData.notes}</textarea>
              <label>Receipt / Invoice</label>
              <input type="file" name="receipt" accept=".png,.jpg,.jpeg,.webp,.pdf,application/pdf,image/png,image/jpeg,image/webp" />
              {isEditingEntry && editingEntry?.receipt_filename ? (
                <div class="muted small" style="margin-top:8px;">
                  Current file attached. <a href={`/fleet/entries/${editingEntry.id}/receipt`}>View receipt</a>
                  <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px;font-weight:700;">
                    <input type="checkbox" name="remove_receipt" value="1" checked={recordFormData.remove_receipt === '1'} style="width:auto;" />
                    Remove existing receipt
                  </label>
                </div>
              ) : null}
              <div class="actions" style="margin-top:14px"><button class="btn btn-primary" type="submit">{isEditingEntry ? 'Save Record' : 'Add Record'}</button></div>
            </form>
          </div>
        </div>
      ) : null}

      <div class="card" style="margin-bottom:14px;">
        <div class="card-head"><b>Vehicles</b><span class="badge">{vehicles.length} total</span></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Vehicle</th><th>Identification</th><th>Status</th><th class="right">Actions</th></tr></thead>
            <tbody>
              {vehicles.length > 0 ? vehicles.map((vehicle) => (
                <tr>
                  <td>
                    <div><b>{vehicle.display_name}</b></div>
                    <div class="muted small" style="margin-top:4px;">{vehicleSubtitle(vehicle)}</div>
                    {vehicle.notes ? <div class="muted small" style="margin-top:4px;">{vehicle.notes}</div> : null}
                  </td>
                  <td>
                    <div>Unit: {vehicle.unit_number || '—'}</div>
                    <div class="muted small" style="margin-top:4px;">Plate: {vehicle.license_plate || '—'} • VIN: {vehicle.vin || '—'}</div>
                  </td>
                  <td>{vehicle.archived_at ? <span class="badge">Archived</span> : vehicle.active ? <span class="badge badge-good">Active</span> : <span class="badge badge-warn">Inactive</span>}</td>
                  <td class="right">
                    <div class="actions" style="justify-content:flex-end;">
                      <a class="btn" href={`/fleet/vehicles/${vehicle.id}`}>View</a>
                      {canManage && !vehicle.archived_at ? <a class="btn" href={`/fleet?editVehicle=${vehicle.id}`}>Edit</a> : null}
                      {canManage && !vehicle.archived_at ? <form method="post" action={`/fleet/vehicles/${vehicle.id}/archive`}><input type="hidden" name="csrf_token" value={csrfToken} /><button class="btn" type="submit">Archive</button></form> : null}
                      {canManage && vehicle.archived_at ? <form method="post" action={`/fleet/vehicles/${vehicle.id}/restore`}><input type="hidden" name="csrf_token" value={csrfToken} /><button class="btn" type="submit">Restore</button></form> : null}
                    </div>
                  </td>
                </tr>
              )) : <tr><td colspan={4} class="muted">No vehicles added yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><b>Fuel & Maintenance Records</b><span class="badge">{entries.length} total</span></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Date / Type</th><th>Vehicle</th><th>Vendor / Detail</th><th class="right">Amount</th><th>Status</th><th class="right">Actions</th></tr></thead>
            <tbody>
              {entries.length > 0 ? entries.map((entry) => (
                <tr>
                  <td><div><b>{entry.entry_date}</b></div><div class="muted small" style="margin-top:4px;text-transform:capitalize;">{entry.entry_type}</div></td>
                  <td><div><b>{entry.vehicle_display_name}</b></div><div class="muted small" style="margin-top:4px;">{entry.vehicle_unit_number || 'No unit number'}</div></td>
                  <td>
                    <div>{entry.vendor || 'No vendor listed'}</div>
                    <div class="muted small" style="margin-top:4px;">Odometer: {entry.odometer ?? '—'}{entry.entry_type === 'fuel' ? ` • Gallons: ${entry.gallons ?? '—'}` : ''}{entry.entry_type === 'maintenance' ? ` • Service: ${entry.service_type || '—'}` : ''}</div>
                    {entry.notes ? <div class="muted small" style="margin-top:4px;">{entry.notes}</div> : null}
                  </td>
                  <td class="right"><b>{fmtMoney(entry.amount)}</b></td>
                  <td>{entry.archived_at ? <span class="badge">Archived</span> : <span class="badge badge-good">Active</span>}</td>
                  <td class="right">
                    <div class="actions" style="justify-content:flex-end;">
                      <a class="btn" href={`/fleet/vehicles/${entry.vehicle_id}`}>Truck</a>
                      {entry.receipt_filename ? <a class="btn" href={`/fleet/entries/${entry.id}/receipt`}>Receipt</a> : null}
                      {canManage && !entry.archived_at ? <a class="btn" href={`/fleet?editEntry=${entry.id}`}>Edit</a> : null}
                      {canManage && !entry.archived_at ? <form method="post" action={`/fleet/entries/${entry.id}/archive`}><input type="hidden" name="csrf_token" value={csrfToken} /><button class="btn" type="submit">Archive</button></form> : null}
                      {canManage && entry.archived_at ? <form method="post" action={`/fleet/entries/${entry.id}/restore`}><input type="hidden" name="csrf_token" value={csrfToken} /><button class="btn" type="submit">Restore</button></form> : null}
                    </div>
                  </td>
                </tr>
              )) : <tr><td colspan={6} class="muted">No fleet records added yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FleetPage;
