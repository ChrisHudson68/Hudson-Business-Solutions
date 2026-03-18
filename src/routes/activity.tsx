import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import { permissionRequired } from '../middleware/auth.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { ActivityPage } from '../pages/activity/ActivityPage.js';

function renderApp(c: any, subtitle: string, content: any, status: 200 | 400 = 200) {
  return c.html(
    <AppLayout
      currentTenant={c.get('tenant')}
      currentSubdomain={c.get('subdomain')}
      currentUser={c.get('user')}
      appName={process.env.APP_NAME || 'Hudson Business Solutions'}
      appLogo={process.env.APP_LOGO || '/static/brand/hudson-business-solutions-logo.png'}
      path={c.req.path}
      csrfToken={c.get('csrfToken')}
      subtitle={subtitle}
    >
      {content}
    </AppLayout>,
    status as any,
  );
}

function parsePositiveInt(value: string): number | null {
  if (!/^\d+$/.test(String(value || '').trim())) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function titleizeEventType(value: string): string {
  return value
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ');
}

const activityRoutes = new Hono<AppEnv>();

activityRoutes.get('/activity', permissionRequired('activity.view'), (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const tenantId = tenant.id;
  const db = getDb();

  const selectedEventType = String(c.req.query('event_type') || '').trim();
  const selectedActorUserId = String(c.req.query('actor_user_id') || '').trim();
  const actorUserId = selectedActorUserId ? parsePositiveInt(selectedActorUserId) : null;

  const whereParts = ['a.tenant_id = ?'];
  const params: Array<string | number> = [tenantId];

  if (selectedEventType) {
    whereParts.push('a.event_type = ?');
    params.push(selectedEventType);
  }

  if (actorUserId) {
    whereParts.push('a.actor_user_id = ?');
    params.push(actorUserId);
  }

  const rows = db.prepare(`
    SELECT
      a.id,
      a.created_at,
      a.event_type,
      a.entity_type,
      a.entity_id,
      a.description,
      a.ip_address,
      a.metadata_json,
      u.name AS actor_name,
      u.email AS actor_email
    FROM activity_logs a
    LEFT JOIN users u
      ON u.id = a.actor_user_id
     AND u.tenant_id = a.tenant_id
    WHERE ${whereParts.join(' AND ')}
    ORDER BY a.id DESC
    LIMIT 200
  `).all(...params) as Array<{
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
  }>;

  const eventTypes = db.prepare(`
    SELECT DISTINCT event_type
    FROM activity_logs
    WHERE tenant_id = ?
    ORDER BY event_type ASC
  `).all(tenantId) as Array<{ event_type: string }>;

  const actors = db.prepare(`
    SELECT DISTINCT u.id, u.name, u.email
    FROM activity_logs a
    JOIN users u
      ON u.id = a.actor_user_id
     AND u.tenant_id = a.tenant_id
    WHERE a.tenant_id = ?
    ORDER BY u.name ASC, u.email ASC
  `).all(tenantId) as Array<{ id: number; name: string; email: string }>;

  return renderApp(
    c,
    'Activity Log',
    <ActivityPage
      rows={rows}
      selectedEventType={selectedEventType}
      selectedActorUserId={selectedActorUserId}
      eventTypes={eventTypes.map((row) => ({
        value: row.event_type,
        label: titleizeEventType(row.event_type),
      }))}
      actors={actors}
    />,
  );
});

export { activityRoutes };
export default activityRoutes;