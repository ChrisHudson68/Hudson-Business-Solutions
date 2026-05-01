import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { PublicLayout } from '../pages/layouts/PublicLayout.js';
import { WebsiteRequestPage } from '../pages/marketing/WebsiteRequestPage.js';
import { getDb } from '../db/connection.js';
import { getEnv } from '../config/env.js';
import { sendMail } from '../services/mailer.js';

export const websiteRequestRoutes = new Hono<AppEnv>();

function renderPage(c: any, props: object) {
  const env = getEnv();
  return c.html(
    <PublicLayout appName={env.appName} appLogo={env.appLogo}>
      <WebsiteRequestPage {...(props as any)} />
    </PublicLayout>,
  );
}

websiteRequestRoutes.get('/website-request', (c) => {
  const csrfToken = c.get('csrfToken');
  return renderPage(c, { csrfToken });
});

websiteRequestRoutes.post('/website-request', async (c) => {
  const csrfToken = c.get('csrfToken');
  const env = getEnv();

  let body: Record<string, string | string[]> = {};
  try {
    body = await c.req.parseBody({ all: true }) as Record<string, string | string[]>;
  } catch {
    return renderPage(c, { csrfToken, error: 'Failed to read form data. Please try again.' });
  }

  const str = (key: string) => String(body[key] ?? '').trim();
  const arr = (key: string): string[] => {
    const val = body[key];
    if (!val) return [];
    return Array.isArray(val) ? val.map(String) : [String(val)];
  };

  // Validate required fields
  const name = str('name');
  const phone = str('phone');
  const email = str('email');
  const orgName = str('org_name');
  const basePackage = str('base_package');
  const websiteSize = str('website_size');
  const designLevel = str('design_level');
  const features = arr('features').join(', ');
  const addons = arr('addons').join(', ');
  const notes = str('notes');

  if (!name) return renderPage(c, { csrfToken, error: 'Name is required.', formData: buildFormData(body) });
  if (!phone) return renderPage(c, { csrfToken, error: 'Phone number is required.', formData: buildFormData(body) });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return renderPage(c, { csrfToken, error: 'A valid email address is required.', formData: buildFormData(body) });
  if (!orgName) return renderPage(c, { csrfToken, error: 'Project or organization name is required.', formData: buildFormData(body) });
  if (!['Starter', 'Growth', 'Premium'].includes(basePackage)) return renderPage(c, { csrfToken, error: 'Please select a base package.', formData: buildFormData(body) });
  if (!['Small', 'Medium', 'Large'].includes(websiteSize)) return renderPage(c, { csrfToken, error: 'Please select a website size.', formData: buildFormData(body) });
  if (!['Basic', 'Custom', 'Advanced'].includes(designLevel)) return renderPage(c, { csrfToken, error: 'Please select a design level.', formData: buildFormData(body) });

  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO website_requests (name, phone, email, org_name, base_package, website_size, design_level, features, addons, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, phone, email, orgName, basePackage, websiteSize, designLevel, features, addons, notes);

    // Send notification email if SMTP is configured
    await sendMail({
      to: env.platformAdminEmail ?? '',
      subject: `New Website Request — ${orgName}`,
      text: [
        `New website request submitted.`,
        `Name: ${name}`,
        `Phone: ${phone}`,
        `Email: ${email}`,
        `Organization: ${orgName}`,
        `Package: ${basePackage}`,
        `Size: ${websiteSize}`,
        `Design: ${designLevel}`,
        `Features: ${features || 'None'}`,
        `Add-ons: ${addons || 'None'}`,
        `Notes: ${notes || 'None'}`,
      ].join('\n'),
      html: `
        <h2>New Website Request</h2>
        <table style="border-collapse:collapse;width:100%;">
          <tr><td style="padding:6px 12px;font-weight:700;background:#f8fafc;">Name</td><td style="padding:6px 12px;">${name}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:700;background:#f8fafc;">Phone</td><td style="padding:6px 12px;">${phone}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:700;background:#f8fafc;">Email</td><td style="padding:6px 12px;">${email}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:700;background:#f8fafc;">Organization</td><td style="padding:6px 12px;">${orgName}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:700;background:#f8fafc;">Package</td><td style="padding:6px 12px;">${basePackage}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:700;background:#f8fafc;">Size</td><td style="padding:6px 12px;">${websiteSize}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:700;background:#f8fafc;">Design Level</td><td style="padding:6px 12px;">${designLevel}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:700;background:#f8fafc;">Features</td><td style="padding:6px 12px;">${features || 'None'}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:700;background:#f8fafc;">Add-ons</td><td style="padding:6px 12px;">${addons || 'None'}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:700;background:#f8fafc;">Notes</td><td style="padding:6px 12px;">${notes || 'None'}</td></tr>
        </table>
      `,
    }).catch(() => {
      // Email failure is non-fatal — request is already saved to DB
    });

    return renderPage(c, { csrfToken, success: true });
  } catch (err) {
    console.error('website-request POST error:', err);
    return renderPage(c, { csrfToken, error: 'Something went wrong saving your request. Please try again.', formData: buildFormData(body) });
  }
});

function buildFormData(body: Record<string, string | string[]>): Record<string, string> {
  const str = (key: string) => String(body[key] ?? '').trim();
  const arr = (key: string): string[] => {
    const val = body[key];
    if (!val) return [];
    return Array.isArray(val) ? val.map(String) : [String(val)];
  };
  const featFlags: Record<string, string> = {};
  for (const f of arr('features')) featFlags[`feat_${f}`] = '1';
  const addonFlags: Record<string, string> = {};
  for (const a of arr('addons')) addonFlags[`addon_${a}`] = '1';

  return {
    name: str('name'),
    phone: str('phone'),
    email: str('email'),
    org_name: str('org_name'),
    base_package: str('base_package'),
    website_size: str('website_size'),
    design_level: str('design_level'),
    notes: str('notes'),
    ...featFlags,
    ...addonFlags,
  };
}
