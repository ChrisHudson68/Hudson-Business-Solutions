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
    assigned_employee_id: number | null;
    assigned_employee_name: string | null;
    assigned_driver_name: string | null;
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
  documents: Array<{
    id: number;
    document_type: string;
    title: string;
    original_filename: string | null;
    expiration_date: string | null;
    notes: string | null;
    archived_at: string | null;
  }>;
  driverOptions: Array<{ id: number; name: string }>;
  assignmentFormData: {
    assigned_employee_id: string;
    assigned_driver_name: string;
  };
  assignmentHistory: Array<{
    id: number;
    previous_employee_name: string | null;
    new_employee_name: string | null;
    previous_driver_name: string | null;
    new_driver_name: string | null;
    note: string | null;
    changed_by_user_name: string | null;
    changed_at: string;
  }>;
  attachmentHistory: Array<{
    source_type: 'receipt' | 'document';
    id: number;
    entry_or_document_date: string | null;
    label: string;
    kind: string;
    archived_at: string | null;
  }>;
  csrfToken: string;
  canManage: boolean;
  getCategoryLabel: (value: string | null) => string;
  getDocumentTypeLabel: (value: string | null) => string;
}

function fmtMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const target = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((targetUtc - todayUtc) / 86400000);
}

export const FleetVehicleDetailPage: FC<FleetVehicleDetailPageProps> = ({
  vehicle,
  summary,
  recentEntries,
  reminders,
  documents,
  driverOptions,
  assignmentFormData,
  assignmentHistory,
  attachmentHistory,
  csrfToken,
  canManage,
  getCategoryLabel,
  getDocumentTypeLabel,
}) => {
  const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'No year / make / model';
  const assignedDriverLabel = vehicle.assigned_employee_name || vehicle.assigned_driver_name || 'Unassigned';

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>
            {vehicle.display_name}
            {' '}
            {vehicle.archived_at
              ? <span class="badge badge-warn">Archived</span>
              : vehicle.active
                ? <span class="badge badge-good">Active</span>
                : <span class="badge">Inactive</span>}
          </h1>
          <p class="muted">
            {vehicleLabel} · Driver: {assignedDriverLabel}
            {vehicle.notes ? ` · ${vehicle.notes}` : ''}
          </p>
        </div>
        <div class="actions">
          <a class="btn" href="/fleet">← Fleet</a>
          <a class="btn" href={`/fleet?vehicleId=${vehicle.id}`}>Add Record</a>
          <a class="btn" href={`/fleet/vehicles/${vehicle.id}/packet`} target="_blank" rel="noreferrer">Print Packet</a>
          <a class="btn" href="/fleet/schedule">Schedule</a>
          {canManage ? <a class="btn btn-primary" href={`/fleet?editVehicle=${vehicle.id}`}>Edit Vehicle</a> : null}
        </div>
      </div>

      {reminders.length > 0 ? (
        <div class="grid grid-3" style="margin-bottom:14px;">
          {reminders.map((reminder) => (
            <div class="card" style={reminder.isDue ? 'border-color:#FECACA;' : ''}>
              <div class="card-head" style="margin-bottom:10px;">
                <b>{reminder.label}</b>
                <span class={reminder.isDue ? 'badge badge-bad' : 'badge badge-good'}>{reminder.isDue ? 'Due' : 'On Track'}</span>
              </div>
              <div class="muted" style="font-size:12px; margin-bottom:10px;">{reminder.reason}</div>
              <div class="grid grid-2" style="gap:8px;">
                <div class="list-item" style="padding:8px 10px;">
                  <div class="muted" style="font-size:11px; font-weight:800; text-transform:uppercase;">Last Service</div>
                  <div style="font-weight:700; margin-top:4px;">{reminder.lastServiceDate || '—'}</div>
                </div>
                <div class="list-item" style="padding:8px 10px;">
                  <div class="muted" style="font-size:11px; font-weight:800; text-transform:uppercase;">Last Odometer</div>
                  <div style="font-weight:700; margin-top:4px;">{reminder.lastServiceOdometer ?? '—'}</div>
                </div>
                <div class="list-item" style="padding:8px 10px;">
                  <div class="muted" style="font-size:11px; font-weight:800; text-transform:uppercase;">Due Date</div>
                  <div style="font-weight:700; margin-top:4px;">{reminder.dueAtDate || '—'}</div>
                </div>
                <div class="list-item" style="padding:8px 10px;">
                  <div class="muted" style="font-size:11px; font-weight:800; text-transform:uppercase;">Due Mileage</div>
                  <div style="font-weight:700; margin-top:4px;">{reminder.dueAtOdometer ?? '—'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div class="stat-grid stat-grid-4" style="margin-bottom:14px;">
        <div class="stat-card stat-card-navy">
          <div class="stat-label">Lifetime Spend</div>
          <div class="stat-value">{fmtMoney(summary.totalSpend)}</div>
        </div>
        <div class="stat-card stat-card-accent">
          <div class="stat-label">Fuel Spend</div>
          <div class="stat-value">{fmtMoney(summary.fuelSpend)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Maintenance Spend</div>
          <div class="stat-value">{fmtMoney(summary.maintenanceSpend)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Latest Odometer</div>
          <div class="stat-value">{summary.latestOdometer ?? '—'}</div>
        </div>
      </div>

      <div class="stat-grid stat-grid-4" style="margin-bottom:14px;">
        <div class="stat-card">
          <div class="stat-label">Fuel Records</div>
          <div class="stat-value">{summary.fuelRecordCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Maintenance Records</div>
          <div class="stat-value">{summary.maintenanceRecordCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Fuel Gallons</div>
          <div class="stat-value">{summary.fuelGallons ? summary.fuelGallons.toFixed(1) : '0.0'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Cost / Gallon</div>
          <div class="stat-value">{summary.avgFuelCostPerGallon === null ? '—' : `$${summary.avgFuelCostPerGallon.toFixed(2)}`}</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <div class="card-head" style="margin-bottom:12px;">
          <h3>Vehicle Details</h3>
        </div>
        <div class="grid grid-2">
          <div class="list">
            <div class="list-item">
              <span class="muted" style="font-size:11px; font-weight:800; text-transform:uppercase; display:block; margin-bottom:4px;">Unit Number</span>
              <span style="font-weight:700;">{vehicle.unit_number || '—'}</span>
            </div>
            <div class="list-item">
              <span class="muted" style="font-size:11px; font-weight:800; text-transform:uppercase; display:block; margin-bottom:4px;">License Plate</span>
              <span style="font-weight:700;">{vehicle.license_plate || '—'}</span>
            </div>
            <div class="list-item">
              <span class="muted" style="font-size:11px; font-weight:800; text-transform:uppercase; display:block; margin-bottom:4px;">VIN</span>
              <span style="font-weight:700;">{vehicle.vin || '—'}</span>
            </div>
            <div class="list-item">
              <span class="muted" style="font-size:11px; font-weight:800; text-transform:uppercase; display:block; margin-bottom:4px;">Assigned Driver</span>
              <span style="font-weight:700;">{assignedDriverLabel}</span>
            </div>
            <div class="list-item">
              <span class="muted" style="font-size:11px; font-weight:800; text-transform:uppercase; display:block; margin-bottom:4px;">Latest Entry Date</span>
              <span style="font-weight:700;">{summary.latestEntryDate || '—'}</span>
            </div>
          </div>
          <div class="list">
            <div class="list-item">
              <span class="muted" style="font-size:11px; font-weight:800; text-transform:uppercase; display:block; margin-bottom:4px;">Active Records</span>
              <span style="font-weight:700;">{summary.activeRecordCount}</span>
            </div>
            <div class="list-item">
              <span class="muted" style="font-size:11px; font-weight:800; text-transform:uppercase; display:block; margin-bottom:4px;">Archived Records</span>
              <span style="font-weight:700;">{summary.archivedRecordCount}</span>
            </div>
            <div class="list-item">
              <span class="muted" style="font-size:11px; font-weight:800; text-transform:uppercase; display:block; margin-bottom:4px;">Fuel Share</span>
              <span style="font-weight:700;">{summary.totalSpend > 0 ? `${((summary.fuelSpend / summary.totalSpend) * 100).toFixed(1)}%` : '0.0%'}</span>
            </div>
            <div class="list-item">
              <span class="muted" style="font-size:11px; font-weight:800; text-transform:uppercase; display:block; margin-bottom:4px;">Maintenance Share</span>
              <span style="font-weight:700;">{summary.totalSpend > 0 ? `${((summary.maintenanceSpend / summary.totalSpend) * 100).toFixed(1)}%` : '0.0%'}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <div class="card-head">
          <h3>Driver Assignment</h3>
          <span class="badge" style="background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); color:#fff;">
            {assignedDriverLabel === 'Unassigned' ? 'Unassigned' : 'Assigned'}
          </span>
        </div>
        <div class="grid grid-2" style="margin-bottom:14px; margin-top:4px;">
          <div class="list-item">
            <span class="muted" style="font-size:11px; font-weight:800; text-transform:uppercase; display:block; margin-bottom:4px;">Assigned Employee</span>
            <span style="font-weight:700;">{vehicle.assigned_employee_name || '—'}</span>
          </div>
          <div class="list-item">
            <span class="muted" style="font-size:11px; font-weight:800; text-transform:uppercase; display:block; margin-bottom:4px;">Driver Label</span>
            <span style="font-weight:700;">{vehicle.assigned_driver_name || '—'}</span>
          </div>
        </div>

        {canManage ? (
          <form method="post" action={`/fleet/vehicles/${vehicle.id}/assignment`}>
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <div class="grid grid-2" style="margin-bottom:12px;">
              <div>
                <label>Assigned Employee</label>
                <select name="assigned_employee_id">
                  <option value="">Unassigned</option>
                  {driverOptions.map((option) => <option value={String(option.id)} selected={assignmentFormData.assigned_employee_id === String(option.id)}>{option.name}</option>)}
                </select>
              </div>
              <div>
                <label>Driver Label</label>
                <input name="assigned_driver_name" value={assignmentFormData.assigned_driver_name} maxLength={120} placeholder="Optional backup label / nickname" />
              </div>
            </div>
            <div class="actions">
              <button class="btn btn-primary" type="submit">Save Assignment</button>
            </div>
          </form>
        ) : null}
      </div>

      <div class="card" style="margin-bottom:14px;">
        <div class="card-head">
          <h3>Assignment History</h3>
          <span class="badge" style="background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); color:#fff;">{assignmentHistory.length}</span>
        </div>
        {assignmentHistory.length > 0 ? (
          <div class="table-wrap" style="margin:0 -18px -16px;">
            <table>
              <thead>
          <tr>
            <th>Changed</th>
            <th>Employee</th>
            <th>Driver Label</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {assignmentHistory.map((item) => (
            <tr>
              <td>
                <div><b>{item.changed_at}</b></div>
                <div class="muted small" style="margin-top:4px;">by {item.changed_by_user_name || 'System'}</div>
              </td>
              <td>
                <div class="muted small">From</div>
                <div>{item.previous_employee_name || 'Unassigned'}</div>
                <div class="muted small" style="margin-top:6px;">To</div>
                <div>{item.new_employee_name || 'Unassigned'}</div>
              </td>
              <td>
                <div class="muted small">From</div>
                <div>{item.previous_driver_name || '—'}</div>
                <div class="muted small" style="margin-top:6px;">To</div>
                <div>{item.new_driver_name || '—'}</div>
              </td>
              <td>{item.note || 'Assignment updated'}</td>
            </tr>
          ))}
            </tbody>
          </table>
        </div>
        ) : (
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <h3>No assignment history yet</h3>
            <p>Driver assignment changes will appear here.</p>
          </div>
        )}
      </div>

      <div class="grid grid-2" style="margin-bottom:14px;">
        <div class="card">
          <div class="card-head">
            <h3>Vehicle Documents</h3>
            <span class="badge" style="background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); color:#fff;">{documents.length}</span>
          </div>

          {documents.length > 0 ? (
            <div class="table-wrap" style="margin:0 -18px -16px;">
              <table>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Expiration</th>
                    <th>Status</th>
                    <th class="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => {
                    const days = daysUntil(document.expiration_date);
                    const statusLabel = document.archived_at
                      ? 'Archived'
                      : days === null
                        ? 'No Expiration'
                        : days < 0
                          ? `${Math.abs(days)} days expired`
                          : days === 0
                            ? 'Expires today'
                            : `${days} days left`;

                    const statusClass = document.archived_at
                      ? 'badge'
                      : days !== null && days <= 7
                        ? 'badge badge-bad'
                        : days !== null && days <= 30
                          ? 'badge badge-warn'
                          : 'badge badge-good';

                    return (
                      <tr>
                        <td>
                          <div><b>{document.title}</b></div>
                          <div class="muted small" style="margin-top:4px;">{getDocumentTypeLabel(document.document_type)}</div>
                          {document.original_filename ? <div class="muted small" style="margin-top:4px;">{document.original_filename}</div> : null}
                          {document.notes ? <div class="muted small" style="margin-top:4px;">{document.notes}</div> : null}
                        </td>
                        <td>{document.expiration_date || '—'}</td>
                        <td><span class={statusClass}>{statusLabel}</span></td>
                        <td class="right">
                          <div class="actions" style="justify-content:flex-end;">
                            <a class="btn" href={`/fleet/documents/${document.id}/file`}>Open</a>
                            {canManage && !document.archived_at ? (
                              <form method="post" action={`/fleet/documents/${document.id}/archive`}>
                                <input type="hidden" name="csrf_token" value={csrfToken} />
                                <button class="btn" type="submit">Archive</button>
                              </form>
                            ) : null}
                            {canManage && document.archived_at ? (
                              <form method="post" action={`/fleet/documents/${document.id}/restore`}>
                                <input type="hidden" name="csrf_token" value={csrfToken} />
                                <button class="btn" type="submit">Restore</button>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div class="empty-state">
              <div class="empty-state-icon">📄</div>
              <h3>No documents yet</h3>
              <p>Upload registration, insurance, and other vehicle documents below.</p>
            </div>
          )}

          {canManage ? (
            <form method="post" action="/fleet/documents" enctype="multipart/form-data" style="margin-top:16px; border-top:1px solid var(--border); padding-top:16px;">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <input type="hidden" name="vehicle_id" value={String(vehicle.id)} />

              <div class="grid grid-2" style="margin-bottom:12px;">
                <div>
                  <label>Document Type</label>
                  <select name="document_type">
                    <option value="registration">Registration</option>
                    <option value="insurance">Insurance</option>
                    <option value="inspection">Inspection</option>
                    <option value="service_contract">Service Contract</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label>Expiration Date</label>
                  <input type="date" name="expiration_date" />
                </div>
              </div>

              <label>Title</label>
              <input name="title" placeholder="Example: 2026 registration card" required />

              <label style="margin-top:12px;">Notes</label>
              <textarea name="notes" rows={3} placeholder="Optional notes"></textarea>

              <label style="margin-top:12px;">Document File</label>
              <input type="file" name="document" accept=".png,.jpg,.jpeg,.webp,.pdf" required />

              <div class="actions" style="margin-top:12px;">
                <button class="btn btn-primary" type="submit">Upload Document</button>
              </div>
            </form>
          ) : null}
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Attachment History</h3>
            <span class="badge" style="background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); color:#fff;">{attachmentHistory.length}</span>
          </div>
          {attachmentHistory.length > 0 ? (
            <div class="list">
              {attachmentHistory.map((item) => (
                <div class="list-item" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                  <div>
                    <div style="font-weight:700;">{item.label}</div>
                    <div class="muted" style="font-size:12px; margin-top:2px;">
                      {item.entry_or_document_date || '—'} · {item.source_type === 'receipt' ? 'Receipt' : 'Document'} · {item.kind}
                    </div>
                  </div>
                  <a class="btn btn-sm" href={item.source_type === 'receipt' ? `/fleet/entries/${item.id}/receipt` : `/fleet/documents/${item.id}/file`}>Open</a>
                </div>
              ))}
            </div>
          ) : (
            <div class="muted" style="margin-top:4px;">No receipts or fleet documents uploaded yet.</div>
          )}
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>Recent Activity</h3>
          <span class="badge" style="background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); color:#fff;">{recentEntries.length} records</span>
        </div>
        <div class="table-wrap" style="margin:0 -18px -16px;">
          <table>
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
