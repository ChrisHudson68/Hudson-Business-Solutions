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

      <div class="card" style="margin-bottom:14px;">
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
        <div class="table-wrap">
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
                      <td>{row.created_at}</td>
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
                        <td colspan={6} style="background:#F8FAFC;">
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
                  <td colspan={6} class="muted">No activity has been logged yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div class="muted" style="margin-top:12px;">
          Phase 1 currently focuses on login and tenant creation events. More business events can be added next without changing the page structure.
        </div>
      </div>
    </div>
  );
};

export { ActivityPage };
export default ActivityPage;