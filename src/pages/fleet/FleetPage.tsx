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
  const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
  return parts.length ? String(parts.join(' ')) : 'Vehicle details not listed';
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
  const isEditingVehicle = Number(editingVehicleId || 0) > 0;
  const isEditingEntry = Number(editingEntryId || 0) > 0;
  const editingEntry = entries.find((entry) => entry.id === editingEntryId) || null;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Fleet</h1>
          <p class="muted">Track company vehicles, fuel receipts, and truck maintenance without mixing those costs into job expenses.</p>
        </div>
      </div>

      <div class="grid grid-4" style="margin-bottom:14px;">
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Active Vehicles</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{summary.activeVehicles}</div>
        </div>
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Fuel MTD</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{fmtMoney(summary.fuelMtd)}</div>
        </div>
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Maintenance MTD</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{fmtMoney(summary.maintenanceMtd)}</div>
        </div>
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Active Records</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{summary.activeRecords}</div>
        </div>
      </div>

      {error ? (
        <div class="card" style="margin-bottom:14px; border-color:#FCA5A5; background:#FEF2F2; color:#991B1B;">
          <b>Unable to save fleet changes.</b>
          <div style="margin-top:6px;">{error}</div>
        </div>
      ) : null}

      {success ? (
        <div class="card" style="margin-bottom:14px; border-color:#86EFAC; background:#F0FDF4; color:#166534;">
          <b>Success</b>
          <div style="margin-top:6px;">{success}</div>
        </div>
      ) : null}

      {canManage ? (
        <div class="grid grid-2" style="margin-bottom:14px; align-items:start;">
          <div class="card">
            <div class="card-head">
              <b>{isEditingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</b>
              {isEditingVehicle ? <a class="btn" href="/fleet">Cancel Edit</a> : null}
            </div>

            <form method="post" action={isEditingVehicle ? `/fleet/vehicles/${editingVehicleId}/update` : '/fleet/vehicles'}>
              <input type="hidden" name="csrf_token" value={csrfToken} />

              <div class="row">
                <div>
                  <label>Display Name</label>
                  <input type="text" name="display_name" value={vehicleFormData.display_name} placeholder="Truck 12" required />
                </div>
                <div>
                  <label>Unit Number</label>
                  <input type="text" name="unit_number" value={vehicleFormData.unit_number} placeholder="Unit 12" />
                </div>
              </div>

              <div class="row">
                <div>
                  <label>Year</label>
                  <input type="number" name="year" value={vehicleFormData.year} min="1900" max="2100" />
                </div>
                <div>
                  <label>Make</label>
                  <input type="text" name="make" value={vehicleFormData.make} placeholder="Ford" />
                </div>
                <div>
                  <label>Model</label>
                  <input type="text" name="model" value={vehicleFormData.model} placeholder="F-250" />
                </div>
              </div>

              <div class="row">
                <div>
                  <label>License Plate</label>
                  <input type="text" name="license_plate" value={vehicleFormData.license_plate} />
                </div>
                <div>
                  <label>VIN</label>
                  <input type="text" name="vin" value={vehicleFormData.vin} />
                </div>
                <div>
                  <label>Status</label>
                  <select name="active">
                    <option value="1" selected={vehicleFormData.active !== '0'}>Active</option>
                    <option value="0" selected={vehicleFormData.active === '0'}>Inactive</option>
                  </select>
                </div>
              </div>

              <label>Notes</label>
              <textarea name="notes" rows={3} placeholder="Optional notes about the truck, assignment, or service history.">{vehicleFormData.notes}</textarea>

              <div class="actions actions-mobile-stack" style="margin-top:14px;">
                <button class="btn btn-primary" type="submit">{isEditingVehicle ? 'Save Vehicle' : 'Add Vehicle'}</button>
              </div>
            </form>
          </div>

          <div class="card">
            <div class="card-head">
              <b>{isEditingEntry ? 'Edit Fleet Record' : 'Add Fleet Record'}</b>
              {isEditingEntry ? <a class="btn" href="/fleet">Cancel Edit</a> : null}
            </div>

            <form method="post" enctype="multipart/form-data" action={isEditingEntry ? `/fleet/entries/${editingEntryId}/update` : '/fleet/entries'}>
              <input type="hidden" name="csrf_token" value={csrfToken} />

              <div class="row">
                <div>
                  <label>Vehicle</label>
                  <select name="vehicle_id" required>
                    <option value="">Select a vehicle</option>
                    {vehicles.filter((vehicle) => !vehicle.archived_at).map((vehicle) => (
                      <option value={String(vehicle.id)} selected={recordFormData.vehicle_id === String(vehicle.id)}>{vehicle.display_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Record Type</label>
                  <select name="entry_type" required>
                    <option value="fuel" selected={recordFormData.entry_type !== 'maintenance'}>Fuel</option>
                    <option value="maintenance" selected={recordFormData.entry_type === 'maintenance'}>Maintenance</option>
                  </select>
                </div>
              </div>

              <div class="row">
                <div>
                  <label>Date</label>
                  <input type="date" name="entry_date" value={recordFormData.entry_date} required />
                </div>
                <div>
                  <label>Vendor</label>
                  <input type="text" name="vendor" value={recordFormData.vendor} placeholder="Sheetz, vendor, shop" />
                </div>
                <div>
                  <label>Amount</label>
                  <input type="number" name="amount" value={recordFormData.amount} min="0.01" step="0.01" required />
                </div>
              </div>

              <div class="row">
                <div>
                  <label>Odometer</label>
                  <input type="number" name="odometer" value={recordFormData.odometer} min="0" step="1" />
                </div>
                <div>
                  <label>Gallons (Fuel Only)</label>
                  <input type="number" name="gallons" value={recordFormData.gallons} min="0" step="0.001" />
                </div>
                <div>
                  <label>Service Type (Maintenance)</label>
                  <input type="text" name="service_type" value={recordFormData.service_type} placeholder="Oil change, tires, brakes" />
                </div>
              </div>

              <label>Notes</label>
              <textarea name="notes" rows={3} placeholder="Optional notes about the receipt or work performed.">{recordFormData.notes}</textarea>

              <label>Receipt / Invoice</label>
              <input type="file" name="receipt" accept=".png,.jpg,.jpeg,.webp,.pdf,application/pdf,image/png,image/jpeg,image/webp" />
              {isEditingEntry && editingEntry?.receipt_filename ? (
                <div class="muted small" style="margin-top:8px;">
                  Current file attached.
                  {' '}
                  <a href={`/fleet/entries/${editingEntry.id}/receipt`}>View receipt</a>
                  <label style="display:flex; gap:8px; align-items:center; margin-top:10px; font-size:13px; font-weight:700;">
                    <input type="checkbox" name="remove_receipt" value="1" checked={recordFormData.remove_receipt === '1'} style="width:auto;" />
                    Remove existing receipt
                  </label>
                </div>
              ) : null}

              <div class="actions actions-mobile-stack" style="margin-top:14px;">
                <button class="btn btn-primary" type="submit">{isEditingEntry ? 'Save Record' : 'Add Record'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div class="card" style="margin-bottom:14px;">
        <div class="card-head">
          <b>Vehicles</b>
          <span class="badge">{vehicles.length} total</span>
        </div>

        <div class="table-wrap table-wrap-tight">
          <table class="table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Identification</th>
                <th>Status</th>
                <th class="right">Action</th>
              </tr>
            </thead>
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
                  <td>
                    {vehicle.archived_at ? <span class="badge">Archived</span> : vehicle.active ? <span class="badge badge-good">Active</span> : <span class="badge badge-warn">Inactive</span>}
                  </td>
                  <td class="right">
                    <div class="actions actions-mobile-stack" style="justify-content:flex-end;">
                      {canManage && !vehicle.archived_at ? <a class="btn" href={`/fleet?editVehicle=${vehicle.id}`}>Edit</a> : null}
                      {canManage && !vehicle.archived_at ? (
                        <form method="post" action={`/fleet/vehicles/${vehicle.id}/archive`}>
                          <input type="hidden" name="csrf_token" value={csrfToken} />
                          <button class="btn" type="submit">Archive</button>
                        </form>
                      ) : null}
                      {canManage && vehicle.archived_at ? (
                        <form method="post" action={`/fleet/vehicles/${vehicle.id}/restore`}>
                          <input type="hidden" name="csrf_token" value={csrfToken} />
                          <button class="btn" type="submit">Restore</button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colspan={4} class="muted">No vehicles added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <b>Fuel & Maintenance Records</b>
          <span class="badge">{entries.length} total</span>
        </div>

        <div class="table-wrap table-wrap-tight">
          <table class="table">
            <thead>
              <tr>
                <th>Date / Type</th>
                <th>Vehicle</th>
                <th>Vendor / Detail</th>
                <th class="right">Amount</th>
                <th>Status</th>
                <th class="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.length > 0 ? entries.map((entry) => (
                <tr>
                  <td>
                    <div><b>{entry.entry_date}</b></div>
                    <div class="muted small" style="margin-top:4px; text-transform:capitalize;">{entry.entry_type}</div>
                  </td>
                  <td>
                    <div><b>{entry.vehicle_display_name}</b></div>
                    <div class="muted small" style="margin-top:4px;">{entry.vehicle_unit_number || 'No unit number'}</div>
                  </td>
                  <td>
                    <div>{entry.vendor || 'No vendor listed'}</div>
                    <div class="muted small" style="margin-top:4px;">
                      Odometer: {entry.odometer ?? '—'}
                      {entry.entry_type === 'fuel' ? ` • Gallons: ${entry.gallons ?? '—'}` : ''}
                      {entry.entry_type === 'maintenance' ? ` • Service: ${entry.service_type || '—'}` : ''}
                    </div>
                    {entry.notes ? <div class="muted small" style="margin-top:4px;">{entry.notes}</div> : null}
                  </td>
                  <td class="right"><b>{fmtMoney(entry.amount)}</b></td>
                  <td>
                    {entry.archived_at ? <span class="badge">Archived</span> : <span class="badge badge-good">Active</span>}
                  </td>
                  <td class="right">
                    <div class="actions actions-mobile-stack" style="justify-content:flex-end;">
                      {entry.receipt_filename ? <a class="btn" href={`/fleet/entries/${entry.id}/receipt`}>Receipt</a> : null}
                      {canManage && !entry.archived_at ? <a class="btn" href={`/fleet?editEntry=${entry.id}`}>Edit</a> : null}
                      {canManage && !entry.archived_at ? (
                        <form method="post" action={`/fleet/entries/${entry.id}/archive`}>
                          <input type="hidden" name="csrf_token" value={csrfToken} />
                          <button class="btn" type="submit">Archive</button>
                        </form>
                      ) : null}
                      {canManage && entry.archived_at ? (
                        <form method="post" action={`/fleet/entries/${entry.id}/restore`}>
                          <input type="hidden" name="csrf_token" value={csrfToken} />
                          <button class="btn" type="submit">Restore</button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colspan={6} class="muted">No fleet records added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FleetPage;
