import type { FC } from 'hono/jsx';

interface ActivityRow {
  id: number;
  created_at: string;
  tenant_id: number;
  tenant_name: string;
  tenant_subdomain: string;
  actor_name: string | null;
  actor_email: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: number | null;
  description: string;
  ip_address: string | null;
  metadata_json: string | null;
}

interface TenantOption {
  id: number;
  name: string;
  subdomain: string;
}

interface EventTypeOption {
  value: string;
  label: string;
}

interface AdminActivityPageProps {
  rows: ActivityRow[];
  selectedTenantId: string;
  selectedEventType: string;
  tenants: TenantOption[];
  eventTypes: EventTypeOption[];
}

function formatMetadata(metadataJson: string | null): string {
  if (!metadataJson) return '';

  try {
    const parsed = JSON.parse(metadataJson) as Record<string, unknown>;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return metadataJson;
  }
}

export const AdminActivityPage: FC<AdminActivityPageProps> = ({
  rows,
  selectedTenantId,
  selectedEventType,
  tenants,
  eventTypes,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Platform Activity</h1>
          <p class="muted">Cross-tenant audit visibility for owner and support operations.</p>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <form method="get" action="/admin/activity">
          <div class="row">
            <div>
              <label>Tenant</label>
              <select name="tenant_id">
                <option value="">All tenants</option>
                {tenants.map((tenant) => (
                  <option
                    value={String(tenant.id)}
                    selected={selectedTenantId === String(tenant.id)}
                  >
                    {tenant.name} ({tenant.subdomain})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Event Type</label>
              <select name="event_type">
                <option value="">All event types</option>
                {eventTypes.map((eventType) => (
                  <option
                    value={eventType.value}
                    selected={selectedEventType === eventType.value}
                  >
                    {eventType.label}
                  </option>
                ))}
              </select>
            </div>

            <div style="flex:0;">
              <label>&nbsp;</label>
              <button class="btn btn-primary" type="submit">Filter</button>
            </div>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="table-wrap" style="margin:0 -18px -16px;">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Tenant</th>
                <th>User</th>
                <th>Event</th>
                <th>Item</th>
                <th>Description</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <>
                    <tr>
                      <td>{row.created_at}</td>
                      <td>
                        <div><b>{row.tenant_name}</b></div>
                        <div class="muted">{row.tenant_subdomain}</div>
                      </td>
                      <td>
                        {row.actor_name ? (
                          <div>
                            <div><b>{row.actor_name}</b></div>
                            <div class="muted">{row.actor_email || ''}</div>
                          </div>
                        ) : (
                          <span class="muted">System / Unknown</span>
                        )}
                      </td>
                      <td>{row.event_type}</td>
                      <td>
                        {row.entity_type ? (
                          <span>
                            {row.entity_type}
                            {row.entity_id ? ` #${row.entity_id}` : ''}
                          </span>
                        ) : (
                          <span class="muted">—</span>
                        )}
                      </td>
                      <td>{row.description}</td>
                      <td>{row.ip_address || <span class="muted">—</span>}</td>
                    </tr>

                    {row.metadata_json ? (
                      <tr>
                        <td colspan={7} style="background:#F8FAFC;">
                          <details>
                            <summary style="cursor:pointer; font-weight:800;">Metadata</summary>
                            <pre
                              style="margin:10px 0 0; white-space:pre-wrap; word-break:break-word; font-size:12px;"
                            >
                              {formatMetadata(row.metadata_json)}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ) : null}
                  </>
                ))
              ) : (
                <tr>
                  <td colspan={7} class="muted">No platform activity found for the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminActivityPage;