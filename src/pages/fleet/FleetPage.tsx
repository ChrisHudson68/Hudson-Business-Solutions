import type { FC } from 'hono/jsx';

interface ReminderListItem {
  vehicleId: number;
  vehicleName: string;
  label: string;
  reason: string;
  isDue: boolean;
}

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
    assigned_employee_id: number | null;
    assigned_employee_name: string | null;
    assigned_driver_name: string | null;
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
    maintenance_category: string | null;
    notes: string | null;
    receipt_filename: string | null;
    archived_at: string | null;
  }>;
  summary: {
    activeVehicles: number;
    archivedVehicles: number;
    fuelMtd: number;
    maintenanceMtd: number;
    activeRecords: number;
    archivedRecords: number;
  };
  dueReminders: ReminderListItem[];
  assignmentSummary: {
    assignedVehicles: number;
    unassignedVehicles: number;
  };
  expiringDocuments: Array<{
    id: number;
    vehicle_id: number;
    vehicle_display_name: string;
    title: string;
    document_type: string;
    expiration_date: string | null;
    days_remaining: number | null;
  }>;
  getDocumentTypeLabel: (value: string | null) => string;
  driverOptions: Array<{ id: number; name: string }>;
  filters: {
    vehicle_id: string;
    entry_type: string;
    archived: string;
    maintenance_category: string;
    date_from: string;
    date_to: string;
    search: string;
  };
  maintenanceCategoryOptions: Array<{ value: string; label: string }>;
  vehicleFormData: {
    display_name: string;
    unit_number: string;
    year: string;
    make: string;
    model: string;
    license_plate: string;
    vin: string;
    assigned_employee_id: string;
    assigned_driver_name: string;
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
    maintenance_category: string;
    notes: string;
    remove_receipt: string;
  };
  editingVehicleId?: number | null;
  editingEntryId?: number | null;
  editingEntry?: {
    id: number;
    receipt_filename: string | null;
  } | null;
  error?: string;
  success?: string;
  csrfToken: string;
  canManage: boolean;
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
  summary,
  dueReminders,
  assignmentSummary,
  expiringDocuments,
  getDocumentTypeLabel,
  driverOptions,
  filters,
  maintenanceCategoryOptions,
  vehicleFormData,
  recordFormData,
  editingVehicleId,
  editingEntryId,
  editingEntry,
  error,
  success,
  csrfToken,
  canManage,
}) => {
  const isEditingVehicle = Boolean(editingVehicleId);
  const isEditingEntry = Boolean(editingEntryId);

  return (
    <div>
      <style>{`
        .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:14px}.stat,.card{background:#fff;border:1px solid var(--border);border-radius:16px;padding:16px;box-shadow:var(--shadow)}.label{font-size:12px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.04em}.value{font-size:24px;font-weight:800;margin-top:8px}.row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.row.two{grid-template-columns:repeat(2,minmax(0,1fr))}.filters{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.filters .wide{grid-column:span 2}.card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px}.muted{color:var(--muted)}.small{font-size:12px}.badge{display:inline-flex;align-items:center;justify-content:center;padding:5px 8px;border-radius:999px;background:#eef2ff;font-size:12px;font-weight:700}.badge-good{background:#ecfdf3;color:#166534}.badge-warn{background:#fff7ed;color:#9a3412}.badge-danger{background:#FEF2F2;color:#991B1B}.table-wrap{overflow:auto}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:12px;border-top:1px solid var(--border);vertical-align:top}.table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);text-align:left}.right{text-align:right}.actions{display:flex;gap:8px;flex-wrap:wrap}.btn{display:inline-flex;align-items:center;justify-content:center;padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:#fff;color:var(--text);font-weight:700;text-decoration:none;cursor:pointer}.btn-primary{background:var(--navy);color:#fff;border-color:var(--navy)}label{display:block;font-size:12px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}input,select,textarea{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:#fff;color:var(--text)}
        .reminders{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:14px}
        @media (max-width:1100px){.stats,.filters,.reminders{grid-template-columns:repeat(2,minmax(0,1fr))}.row,.row.two{grid-template-columns:1fr}}
        @media (max-width:700px){.stats,.filters,.reminders{grid-template-columns:1fr}}
      `}</style>

      <div class="page-head">
        <div>
          <h1>Fleet</h1>
          <p>Track company vehicles, fuel receipts, truck maintenance, service reminders, and fleet operating costs.</p>
        </div>
        <div class="actions">
          <a class="btn" href="/fleet/schedule">Schedule View</a>
          <a class="btn" href="/fleet/export.csv">Export Current Fleet CSV</a>
          {canManage ? <a class="btn btn-primary" href="#fleet-forms">Add / Edit Records</a> : null}
        </div>
      </div>

      {error ? <div class="card" style="margin-bottom:14px;border-color:#FECACA;background:#FEF2F2;color:#991B1B;">{error}</div> : null}
      {success ? <div class="card" style="margin-bottom:14px;border-color:#BBF7D0;background:#F0FDF4;color:#166534;">{success}</div> : null}

      <div class="stats">
        <div class="stat"><div class="label">Active Vehicles</div><div class="value">{summary.activeVehicles}</div></div>
        <div class="stat"><div class="label">Assigned Drivers</div><div class="value">{assignmentSummary.assignedVehicles}</div></div>
        <div class="stat"><div class="label">Fuel MTD</div><div class="value">{fmtMoney(summary.fuelMtd)}</div></div>
        <div class="stat"><div class="label">Maintenance MTD</div><div class="value">{fmtMoney(summary.maintenanceMtd)}</div></div>
      </div>

      <div class="reminders">
        <div class="card">
          <div class="card-head"><b>Service Reminders</b><span class="badge">{dueReminders.length}</span></div>
          {dueReminders.length > 0 ? dueReminders.slice(0, 5).map((item) => (
            <div style="padding:10px 0;border-top:1px solid var(--border);">
              <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
                <a href={`/fleet/vehicles/${item.vehicleId}`}><b>{item.vehicleName}</b></a>
                <span class={item.isDue ? 'badge badge-danger' : 'badge badge-good'}>{item.label}</span>
              </div>
              <div class="muted small" style="margin-top:4px;">{item.reason}</div>
            </div>
          )) : <div class="muted">No due service reminders right now.</div>}
        </div>

        <div class="card">
          <div class="card-head"><b>Renewal Watch</b><span class="badge">{expiringDocuments.length}</span></div>
          {expiringDocuments.length > 0 ? expiringDocuments.slice(0, 5).map((document) => (
            <div style="padding:10px 0;border-top:1px solid var(--border);">
              <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
                <a href={`/fleet/vehicles/${document.vehicle_id}`}><b>{document.vehicle_display_name}</b></a>
                <span class={document.days_remaining !== null && document.days_remaining <= 7 ? 'badge badge-danger' : 'badge badge-warn'}>
                  {document.days_remaining === null ? 'Needs Date' : document.days_remaining < 0 ? `${Math.abs(document.days_remaining)}d past` : `${document.days_remaining}d`}
                </span>
              </div>
              <div class="muted small" style="margin-top:4px;">{document.title} • {getDocumentTypeLabel(document.document_type)} • {document.expiration_date || 'No expiration'}</div>
            </div>
          )) : <div class="muted">No registration or insurance renewals are coming due soon.</div>}
        </div>

        <div class="card">
          <div class="card-head"><b>Quick Links</b></div>
          <div class="muted small">Unassigned vehicles: {assignmentSummary.unassignedVehicles}</div>
          <div class="muted small" style="margin-top:6px;">Archived records: {summary.archivedRecords}</div>
          <div class="actions" style="margin-top:12px;">
            <a class="btn" href="/settings">Fleet Reminder Settings</a>
            <a class="btn" href="/fleet/export.csv">Export CSV</a>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <div class="card-head"><b>Filter Fleet Records</b></div>
        <form method="get" action="/fleet">
          <div class="filters">
            <div>
              <label>Vehicle</label>
              <select name="vehicleId">
                <option value="">All vehicles</option>
                {vehicles.map((vehicle) => <option value={String(vehicle.id)} selected={filters.vehicle_id === String(vehicle.id)}>{vehicle.display_name}</option>)}
              </select>
            </div>
            <div>
              <label>Type</label>
              <select name="entryType">
                <option value="all" selected={filters.entry_type === 'all'}>All</option>
                <option value="fuel" selected={filters.entry_type === 'fuel'}>Fuel</option>
                <option value="maintenance" selected={filters.entry_type === 'maintenance'}>Maintenance</option>
              </select>
            </div>
            <div>
              <label>Status</label>
              <select name="archived">
                <option value="all" selected={filters.archived === 'all'}>All</option>
                <option value="active" selected={filters.archived === 'active'}>Active</option>
                <option value="archived" selected={filters.archived === 'archived'}>Archived</option>
              </select>
            </div>
            <div>
              <label>Maintenance Category</label>
              <select name="maintenanceCategory">
                <option value="all" selected={filters.maintenance_category === 'all'}>All</option>
                {maintenanceCategoryOptions.map((option) => <option value={option.value} selected={filters.maintenance_category === option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label>Date From</label>
              <input type="date" name="dateFrom" value={filters.date_from} />
            </div>
            <div>
              <label>Date To</label>
              <input type="date" name="dateTo" value={filters.date_to} />
            </div>
            <div class="wide">
              <label>Search</label>
              <input type="text" name="search" value={filters.search} placeholder="Vehicle, vendor, service, notes..." />
            </div>
          </div>
          <div class="actions" style="margin-top:14px;">
            <button class="btn btn-primary" type="submit">Apply Filters</button>
            <a class="btn" href="/fleet">Reset</a>
            <a class="btn" href={`/fleet/export.csv?vehicleId=${encodeURIComponent(filters.vehicle_id)}&entryType=${encodeURIComponent(filters.entry_type)}&archived=${encodeURIComponent(filters.archived)}&maintenanceCategory=${encodeURIComponent(filters.maintenance_category)}&dateFrom=${encodeURIComponent(filters.date_from)}&dateTo=${encodeURIComponent(filters.date_to)}&search=${encodeURIComponent(filters.search)}`}>Export Filtered CSV</a>
          </div>
        </form>
      </div>

      {canManage ? (
        <div id="fleet-forms" class="grid grid-2" style="margin-bottom:14px;">
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
                <div><label>Service Type</label><input type="text" name="service_type" value={recordFormData.service_type} placeholder="Oil and filter, state inspection, brake pads..." /></div>
              </div>
              <div class="row two">
                <div>
                  <label>Maintenance Category</label>
                  <select name="maintenance_category">
                    <option value="">Not applicable / fuel</option>
                    {maintenanceCategoryOptions.map((option) => <option value={option.value} selected={recordFormData.maintenance_category === option.value}>{option.label}</option>)}
                  </select>
                </div>
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
        <div class="card-head"><b>Fuel & Maintenance Records</b><span class="badge">{entries.length} shown</span></div>
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
                    <div class="muted small" style="margin-top:4px;">Odometer: {entry.odometer ?? '—'}{entry.entry_type === 'fuel' ? ` • Gallons: ${entry.gallons ?? '—'}` : ''}{entry.entry_type === 'maintenance' ? ` • Service: ${entry.service_type || '—'} • Category: ${maintenanceCategoryOptions.find((option) => option.value === entry.maintenance_category)?.label || 'Uncategorized'}` : ''}</div>
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
              )) : <tr><td colspan={6} class="muted">No fleet records matched the current filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FleetPage;
