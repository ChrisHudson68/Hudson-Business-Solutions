import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import { loginRequired } from '../middleware/auth.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { SupportPage } from '../pages/support/SupportPage.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';

type SupportNotice = {
  tone: 'good' | 'warn' | 'bad';
  message: string;
};

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

function normalizePriority(value: unknown): 'low' | 'normal' | 'high' | 'critical' {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'low' || normalized === 'normal' || normalized === 'high' || normalized === 'critical') {
    return normalized;
  }

  return 'normal';
}

function resolveNotice(c: any): SupportNotice | undefined {
  const created = String(c.req.query('created') || '').trim().toLowerCase();
  const error = String(c.req.query('error') || '').trim().toLowerCase();

  if (created === '1') {
    return {
      tone: 'good',
      message: 'Your support request was submitted successfully. You can track updates below in Ticket History.',
    };
  }

  if (error === 'subject-required') {
    return { tone: 'bad', message: 'Please enter a subject for your support request.' };
  }

  if (error === 'subject-too-long') {
    return { tone: 'bad', message: 'Subject must be 140 characters or less.' };
  }

  if (error === 'message-required') {
    return { tone: 'bad', message: 'Please enter a message describing the issue.' };
  }

  if (error === 'message-too-long') {
    return { tone: 'bad', message: 'Message must be 5000 characters or less.' };
  }

  return undefined;
}

function getSupportTickets(db: any, tenantId: number) {
  return db.prepare(`
    SELECT
      st.id,
      st.subject,
      st.message,
      st.priority,
      st.status,
      st.internal_notes,
      st.created_at,
      st.updated_at,
      u.name AS created_by_name,
      u.email AS created_by_email
    FROM support_tickets st
    LEFT JOIN users u
      ON u.id = st.created_by_user_id
    WHERE st.tenant_id = ?
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
  `).all(tenantId) as Array<{
    id: number;
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

export const supportRoutes = new Hono<AppEnv>();

supportRoutes.get('/support', loginRequired, (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const db = getDb();
  const tickets = getSupportTickets(db, tenant.id);
  const notice = resolveNotice(c);

  return renderApp(
    c,
    'Support Center',
    <SupportPage
      tickets={tickets}
      csrfToken={c.get('csrfToken')}
      notice={notice}
    />,
  );
});

supportRoutes.post('/support', loginRequired, async (c) => {
  const tenant = c.get('tenant');
  const user = c.get('user');

  if (!tenant || !user) return c.redirect('/login');

  const body = (await c.req.parseBody()) as Record<string, unknown>;

  const subject = String(body.subject ?? '').trim();
  const message = String(body.message ?? '').trim();
  const priority = normalizePriority(body.priority);

  if (!subject) {
    const db = getDb();
    const tickets = getSupportTickets(db, tenant.id);

    return renderApp(
      c,
      'Support Center',
      <SupportPage
        tickets={tickets}
        csrfToken={c.get('csrfToken')}
        notice={{ tone: 'bad', message: 'Please enter a subject for your support request.' }}
        formData={{ subject, priority, message }}
      />,
      400,
    );
  }

  if (subject.length > 140) {
    const db = getDb();
    const tickets = getSupportTickets(db, tenant.id);

    return renderApp(
      c,
      'Support Center',
      <SupportPage
        tickets={tickets}
        csrfToken={c.get('csrfToken')}
        notice={{ tone: 'bad', message: 'Subject must be 140 characters or less.' }}
        formData={{ subject, priority, message }}
      />,
      400,
    );
  }

  if (!message) {
    const db = getDb();
    const tickets = getSupportTickets(db, tenant.id);

    return renderApp(
      c,
      'Support Center',
      <SupportPage
        tickets={tickets}
        csrfToken={c.get('csrfToken')}
        notice={{ tone: 'bad', message: 'Please enter a message describing the issue.' }}
        formData={{ subject, priority, message }}
      />,
      400,
    );
  }

  if (message.length > 5000) {
    const db = getDb();
    const tickets = getSupportTickets(db, tenant.id);

    return renderApp(
      c,
      'Support Center',
      <SupportPage
        tickets={tickets}
        csrfToken={c.get('csrfToken')}
        notice={{ tone: 'bad', message: 'Message must be 5000 characters or less.' }}
        formData={{ subject, priority, message }}
      />,
      400,
    );
  }

  const db = getDb();

  const result = db.prepare(`
    INSERT INTO support_tickets (
      tenant_id,
      created_by_user_id,
      subject,
      message,
      priority,
      status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    tenant.id,
    user.id,
    subject,
    message,
    priority,
  );

  logActivity(db, {
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: 'support.ticket.created',
    entityType: 'support_ticket',
    entityId: Number(result.lastInsertRowid),
    description: `Support ticket "${subject}" was created with ${priority} priority.`,
    metadata: {
      subject,
      priority,
      status: 'open',
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect('/support?created=1');
});

export default supportRoutes;