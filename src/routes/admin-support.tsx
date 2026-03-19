import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import { platformAdminRequired } from '../middleware/platform-admin.js';
import { getEnv } from '../config/env.js';
import { AdminLayout } from '../pages/admin/AdminLayout.js';
import { AdminSupportQueuePage } from '../pages/admin/AdminSupportQueuePage.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';

type SupportPriority = 'low' | 'normal' | 'high' | 'critical';
type SupportStatus = 'open' | 'in_progress' | 'waiting_on_customer' | 'closed';

function renderAdminLayout(c: any, subtitle: string, children: any, status = 200) {
  const env = getEnv();

  return c.html(
    <AdminLayout
      currentAdmin={c.get('platformAdmin')}
      appName={env.appName}
      path={c.req.path}
      subtitle={subtitle}
    >
      {children}
    </AdminLayout>,
    status,
  );
}

function normalizePriority(value: unknown): SupportPriority | '' {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'low' || normalized === 'normal' || normalized === 'high' || normalized === 'critical') {
    return normalized;
  }

  return '';
}

function normalizeStatus(value: unknown): SupportStatus | '' {
  const normalized = String(value || '').trim().toLowerCase();

  if (
    normalized === 'open' ||
    normalized === 'in_progress' ||
    normalized === 'waiting_on_customer' ||
    normalized === 'closed'
  ) {
    return normalized;
  }

  return '';
}

function parseTenantId(value: unknown): number | null {
  const raw = String(value || '').trim();
  if (!/^\d+$/.test(raw)) return null;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;

  return parsed;
}

function parseTicketId(value: string): number | null {
  if (!/^\d+$/.test(String(value || '').trim())) return null;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;

  return parsed;
}

function resolveNotice(c: any): { tone: 'good' | 'bad'; message: string } | undefined {
  const updated = String(c.req.query('updated') || '').trim().toLowerCase();
  const error = String(c.req.query('error') || '').trim().toLowerCase();

  if (updated === 'ticket') {
    return { tone: 'good', message: 'Support ticket was updated.' };
  }

  if (error === 'ticket-not-found') {
    return { tone: 'bad', message: 'Support ticket was not found.' };
  }

  if (error === 'invalid-priority') {
    return { tone: 'bad', message: 'Support priority is invalid.' };
  }

  if (error === 'invalid-status') {
    return { tone: 'bad', message: 'Support status is invalid.' };
  }

  if (error === 'notes-too-long') {
    return { tone: 'bad', message: 'Internal notes must be 5000 characters or less.' };
  }

  return undefined;
}

function getTenantOptions(db: any) {
  return db.prepare(`
    SELECT id, name, subdomain
    FROM tenants
    ORDER BY name ASC
  `).all() as Array<{ id: number; name: string; subdomain: string }>;
}

function getTickets(
  db: any,
  filters: {
    tenantId: number | null;
    priority: SupportPriority | '';
    status: SupportStatus | '';
  },
) {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.tenantId) {
    where.push('st.tenant_id = ?');
    params.push(filters.tenantId);
  }

  if (filters.priority) {
    where.push('st.priority = ?');
    params.push(filters.priority);
  }

  if (filters.status) {
    where.push('st.status = ?');
    params.push(filters.status);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return db.prepare(`
    SELECT
      st.id,
      st.tenant_id,
      st.subject,
      st.message,
      st.priority,
      st.status,
      st.internal_notes,
      st.created_at,
      st.updated_at,
      t.name AS tenant_name,
      t.subdomain AS tenant_subdomain,
      u.name AS created_by_name,
      u.email AS created_by_email
    FROM support_tickets st
    INNER JOIN tenants t
      ON t.id = st.tenant_id
    LEFT JOIN users u
      ON u.id = st.created_by_user_id
    ${whereSql}
    ORDER BY
      CASE st.status
        WHEN 'open' THEN 1
        WHEN 'in_progress' THEN 2
        WHEN 'waiting_on_customer' THEN 3
        WHEN 'closed' THEN 4
        ELSE 5
      END,
      CASE st.priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END,
      st.created_at DESC
  `).all(...params) as Array<{
    id: number;
    tenant_id: number;
    tenant_name: string;
    tenant_subdomain: string;
    subject: string;
    message: string;
    priority: string;
    status: string;
    internal_notes: string | null;
    created_at: string;
    updated_at: string;
    created_by_name: string | null;
    created_by_email: string | null;
  }>;
}

export const adminSupportRoutes = new Hono<AppEnv>();

adminSupportRoutes.get('/admin/support', platformAdminRequired, (c) => {
  const db = getDb();

  const selectedTenantId = String(c.req.query('tenant_id') || '').trim();
  const selectedPriority = normalizePriority(c.req.query('priority'));
  const selectedStatus = normalizeStatus(c.req.query('status'));

  const filters = {
    tenantId: parseTenantId(selectedTenantId),
    priority: selectedPriority,
    status: selectedStatus,
  };

  const tenants = getTenantOptions(db);
  const tickets = getTickets(db, filters);
  const notice = resolveNotice(c);

  return renderAdminLayout(
    c,
    'Cross-tenant support queue',
    <AdminSupportQueuePage
      tickets={tickets}
      tenants={tenants}
      csrfToken={c.get('csrfToken')}
      selectedTenantId={selectedTenantId}
      selectedPriority={selectedPriority}
      selectedStatus={selectedStatus}
      notice={notice}
    />,
  );
});

adminSupportRoutes.post('/admin/support/:id/update', platformAdminRequired, async (c) => {
  const ticketId = parseTicketId(c.req.param('id'));
  if (!ticketId) {
    return c.redirect('/admin/support?error=ticket-not-found');
  }

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const priority = normalizePriority(body.priority);
  const status = normalizeStatus(body.status);
  const internalNotes = String(body.internal_notes ?? '').trim();

  if (!priority) {
    return c.redirect('/admin/support?error=invalid-priority');
  }

  if (!status) {
    return c.redirect('/admin/support?error=invalid-status');
  }

  if (internalNotes.length > 5000) {
    return c.redirect('/admin/support?error=notes-too-long');
  }

  const db = getDb();

  const existing = db.prepare(`
    SELECT id, tenant_id, subject, priority, status, internal_notes
    FROM support_tickets
    WHERE id = ?
    LIMIT 1
  `).get(ticketId) as
    | {
        id: number;
        tenant_id: number;
        subject: string;
        priority: string;
        status: string;
        internal_notes: string | null;
      }
    | undefined;

  if (!existing) {
    return c.redirect('/admin/support?error=ticket-not-found');
  }

  const resolvedAt = status === 'closed' ? 'CURRENT_TIMESTAMP' : 'NULL';

  db.prepare(`
    UPDATE support_tickets
    SET
      priority = ?,
      status = ?,
      internal_notes = ?,
      resolved_at = ${resolvedAt},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    priority,
    status,
    internalNotes || null,
    ticketId,
  );

  const platformAdmin = c.get('platformAdmin');

  logActivity(db, {
    tenantId: existing.tenant_id,
    actorUserId: null,
    eventType: 'support.ticket.updated',
    entityType: 'support_ticket',
    entityId: ticketId,
    description: `Platform admin ${platformAdmin?.email || 'unknown'} updated support ticket "${existing.subject}".`,
    metadata: {
      admin_email: platformAdmin?.email || null,
      previous_priority: existing.priority,
      new_priority: priority,
      previous_status: existing.status,
      new_status: status,
      internal_notes_present: internalNotes ? 1 : 0,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect('/admin/support?updated=ticket');
});