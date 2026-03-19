import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { PublicLayout } from '../pages/layouts/PublicLayout.js';
import { TermsPage } from '../pages/legal/TermsPage.js';
import { PrivacyPage } from '../pages/legal/PrivacyPage.js';
import { ContactPage } from '../pages/legal/ContactPage.js';
import { getEnv } from '../config/env.js';

export const legalRoutes = new Hono<AppEnv>();

function renderPublicLayout(children: any) {
  const env = getEnv();

  return (
    <PublicLayout appName={env.appName} appLogo={env.appLogo}>
      {children}
    </PublicLayout>
  );
}

legalRoutes.get('/terms', (c) => {
  const env = getEnv();

  return c.html(
    renderPublicLayout(
      <TermsPage appName={env.appName} />,
    ),
  );
});

legalRoutes.get('/privacy', (c) => {
  const env = getEnv();

  return c.html(
    renderPublicLayout(
      <PrivacyPage appName={env.appName} />,
    ),
  );
});

legalRoutes.get('/contact', (c) => {
  const env = getEnv();

  return c.html(
    renderPublicLayout(
      <ContactPage appName={env.appName} />,
    ),
  );
});