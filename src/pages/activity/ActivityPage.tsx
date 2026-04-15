import type { FC } from 'hono/jsx';

interface ActivityRow {
  id: number;
  created_at: string;
  event_type: string;
  entity_type: string | null;
  entity_id: number | null;
  description: string;
  actor_name: string | null;
  actor_email: string | null;
  ip_address: string | null;
  metadata_json: string | null;
}

interface EventTypeOption {
  value: string;
  label: string;
}

interface ActorOption {
  id: number;
  name: string;
  email: string;
}

interface ActivityPageProps {
  rows: ActivityRow[];
  selectedEventType: string;
  selectedActorUserId: string;
  eventTypes: EventTypeOption[];
  actors: ActorOption[];
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

const ActivityPage: FC<ActivityPageProps> = ({
  rows,
  selectedEventType,
  selectedActorUserId,
  eventTypes,
  actors,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Activity Log</h1>
          <p class="muted">Review important account and system actions for this company.</p>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-head">
          <h2>Filter Activity</h2>
        </div>
        <form method="get" action="/activity">
          <div class="row">
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

            <div>
              <label>User</label>
              <select name="actor_user_id">
                <option value="">All users</option>
                {actors.map((actor) => (
                  <option
                    value={String(actor.id)}
                    selected={selectedActorUserId === String(actor.id)}
                  >
                    {actor.name} ({actor.email})
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
        <div class="card-head">
          <h2>Event Log</h2>
          <span class="badge" style="background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); color:#fff;">
            {rows.length} event{rows.length === 1 ? '' : 's'}
          </span>
        </div>
        <div class="table-wrap" style="margin:0 -18px -16px;">
          <table>
            <thead>
              <tr>
                <th>When</th>
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
                      <td style="white-space:nowrap; font-size:12px;">{row.created_at}</td>
                      <td>
                        {row.actor_name ? (
                          <div>
                            <div style="font-weight:700;">{row.actor_name}</div>
                            <div class="muted" style="font-size:12px;">{row.actor_email || ''}</div>
                          </div>
                        ) : (
                          <span class="muted">System</span>
                        )}
                      </td>
                      <td><span class="badge" style="font-size:10.5px;">{row.event_type}</span></td>
                      <td class="muted" style="font-size:12px;">
                        {row.entity_type
                          ? `${row.entity_type}${row.entity_id ? ` #${row.entity_id}` : ''}`
                          : '—'}
                      </td>
                      <td style="font-size:13px;">{row.description}</td>
                      <td class="muted" style="font-size:12px;">{row.ip_address || '—'}</td>
                    </tr>
                    {row.metadata_json ? (
                      <tr>
                        <td colSpan={6} style="background:#F8FAFC; padding:8px 14px;">
                          <details>
                            <summary style="cursor:pointer; font-weight:700; font-size:12px;">View metadata</summary>
                            <pre style="margin:8px 0 0; white-space:pre-wrap; word-break:break-word; font-size:11px; color:var(--muted);">
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
                  <td colSpan={6}>
                    <div class="empty-state" style="padding:32px 20px;">
                      <div class="empty-state-icon">📝</div>
                      <h3>No activity logged yet</h3>
                      <p>Events will appear here as users interact with the workspace.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export { ActivityPage };
export default ActivityPage;