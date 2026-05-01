import type { FC } from 'hono/jsx';

interface LandingPageProps {
  appName: string;
  appLogo: string;
}

export const LandingPage: FC<LandingPageProps> = ({ appName, appLogo }) => {
  return (
    <div>
      <style>{`
        .lp { display:flex; flex-direction:column; gap:0; }

        /* ── HERO ── */
        .lp-hero {
          background:linear-gradient(135deg, #0F1F35 0%, #1E3A5F 60%, #1a3356 100%);
          border-radius:22px;
          padding:56px 52px 52px;
          position:relative;
          overflow:hidden;
          margin-bottom:20px;
        }
        .lp-hero::before {
          content:'';
          position:absolute;
          inset:0;
          background:radial-gradient(ellipse 80% 60% at 70% 50%, rgba(245,158,11,0.07) 0%, transparent 70%);
          pointer-events:none;
        }
        .lp-hero-inner {
          display:grid;
          grid-template-columns:1fr minmax(0,420px);
          gap:48px;
          align-items:center;
          position:relative;
          z-index:1;
        }
        .lp-eyebrow {
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:6px 14px;
          border-radius:999px;
          border:1px solid rgba(245,158,11,0.4);
          background:rgba(245,158,11,0.12);
          color:#FCD34D;
          font-size:12px;
          font-weight:800;
          letter-spacing:.08em;
          text-transform:uppercase;
          margin-bottom:20px;
        }
        .lp-h1 {
          margin:0 0 18px;
          font-size:52px;
          line-height:1.02;
          letter-spacing:-0.04em;
          font-weight:900;
          color:#FFFFFF;
        }
        .lp-h1 span { color:#F59E0B; }
        .lp-hero-copy {
          margin:0 0 28px;
          font-size:17px;
          line-height:1.75;
          color:rgba(255,255,255,0.72);
          max-width:580px;
        }
        .lp-hero-actions {
          display:flex;
          gap:12px;
          flex-wrap:wrap;
        }
        .lp-btn-primary {
          display:inline-flex;
          align-items:center;
          justify-content:center;
          height:48px;
          padding:0 24px;
          border-radius:12px;
          background:#F59E0B;
          color:#0F172A;
          font-weight:800;
          font-size:15px;
          text-decoration:none;
          border:none;
          cursor:pointer;
          transition:filter .15s;
        }
        .lp-btn-primary:hover { filter:brightness(1.08); text-decoration:none; }
        .lp-btn-ghost {
          display:inline-flex;
          align-items:center;
          justify-content:center;
          height:48px;
          padding:0 22px;
          border-radius:12px;
          background:rgba(255,255,255,0.1);
          border:1px solid rgba(255,255,255,0.22);
          color:#FFFFFF;
          font-weight:700;
          font-size:15px;
          text-decoration:none;
          cursor:pointer;
          transition:background .15s;
        }
        .lp-btn-ghost:hover { background:rgba(255,255,255,0.16); text-decoration:none; }

        /* hero right panel */
        .lp-hero-panel {
          background:rgba(255,255,255,0.06);
          border:1px solid rgba(255,255,255,0.12);
          border-radius:18px;
          padding:24px;
          backdrop-filter:blur(4px);
        }
        .lp-stats-grid {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:12px;
          margin-bottom:14px;
        }
        .lp-stat {
          background:rgba(255,255,255,0.07);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:14px;
          padding:16px 14px;
        }
        .lp-stat-icon { font-size:20px; margin-bottom:6px; }
        .lp-stat-label {
          color:rgba(255,255,255,0.5);
          font-size:11px;
          font-weight:800;
          text-transform:uppercase;
          letter-spacing:.06em;
        }
        .lp-stat-value {
          color:#FFFFFF;
          font-size:20px;
          font-weight:900;
          margin-top:4px;
        }
        .lp-hero-callout {
          background:rgba(245,158,11,0.12);
          border:1px solid rgba(245,158,11,0.25);
          border-radius:14px;
          padding:14px 16px;
        }
        .lp-hero-callout-title {
          color:#FCD34D;
          font-weight:800;
          font-size:13px;
          margin-bottom:6px;
        }
        .lp-hero-callout-copy {
          color:rgba(255,255,255,0.65);
          font-size:13px;
          line-height:1.65;
        }

        /* ── SECTION WRAPPERS ── */
        .lp-section {
          padding:40px 0 20px;
        }
        .lp-section-tag {
          display:inline-flex;
          align-items:center;
          gap:7px;
          padding:5px 12px;
          border-radius:999px;
          background:#EFF6FF;
          border:1px solid #DBEAFE;
          color:#1D4ED8;
          font-size:11px;
          font-weight:800;
          letter-spacing:.08em;
          text-transform:uppercase;
          margin-bottom:12px;
        }
        .lp-section-h2 {
          margin:0 0 8px;
          font-size:34px;
          font-weight:900;
          letter-spacing:-0.03em;
          color:#0F172A;
        }
        .lp-section-copy {
          margin:0 0 28px;
          color:#475569;
          line-height:1.8;
          font-size:16px;
          max-width:680px;
        }

        /* ── FEATURES ── */
        .lp-feature-grid {
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:16px;
        }
        .lp-feature-card {
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:18px;
          padding:22px 20px;
          box-shadow:0 4px 16px rgba(15,23,42,0.05);
          transition:box-shadow .15s, transform .15s;
        }
        .lp-feature-card:hover {
          box-shadow:0 8px 28px rgba(15,23,42,0.1);
          transform:translateY(-2px);
        }
        .lp-feature-icon {
          width:44px;
          height:44px;
          border-radius:12px;
          background:linear-gradient(135deg, #1E3A5F 0%, #2d5a9e 100%);
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:20px;
          margin-bottom:14px;
        }
        .lp-feature-title {
          font-weight:900;
          font-size:16px;
          color:#0F172A;
          margin-bottom:8px;
        }
        .lp-feature-copy {
          color:#64748B;
          line-height:1.7;
          font-size:14px;
        }

        /* ── HOW IT WORKS ── */
        .lp-steps {
          background:linear-gradient(135deg, #0F1F35 0%, #1E3A5F 100%);
          border-radius:22px;
          padding:40px 44px;
          margin:8px 0;
        }
        .lp-steps .lp-section-h2 { color:#FFFFFF; }
        .lp-steps .lp-section-copy { color:rgba(255,255,255,0.6); margin-bottom:32px; }
        .lp-steps .lp-section-tag {
          background:rgba(245,158,11,0.15);
          border-color:rgba(245,158,11,0.3);
          color:#FCD34D;
        }
        .lp-step-grid {
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:20px;
        }
        .lp-step {
          position:relative;
        }
        .lp-step-num {
          width:44px;
          height:44px;
          border-radius:999px;
          background:#F59E0B;
          color:#0F172A;
          font-weight:900;
          font-size:18px;
          display:flex;
          align-items:center;
          justify-content:center;
          margin-bottom:14px;
          flex-shrink:0;
        }
        .lp-step-title {
          font-weight:900;
          font-size:16px;
          color:#FFFFFF;
          margin-bottom:8px;
        }
        .lp-step-copy {
          color:rgba(255,255,255,0.6);
          line-height:1.7;
          font-size:14px;
        }

        /* ── PRICING ── */
        .lp-pricing-wrap {
          display:grid;
          grid-template-columns:minmax(0,1fr) minmax(0,400px);
          gap:32px;
          align-items:center;
          padding:40px 0 20px;
        }
        .lp-pricing-card {
          background:#FFFFFF;
          border:2px solid #1E3A5F;
          border-radius:22px;
          padding:32px;
          box-shadow:0 20px 48px rgba(30,58,95,0.12);
        }
        .lp-price-tag {
          display:inline-flex;
          align-items:center;
          padding:5px 12px;
          border-radius:999px;
          background:#EFF6FF;
          border:1px solid #DBEAFE;
          color:#1D4ED8;
          font-size:11px;
          font-weight:800;
          letter-spacing:.08em;
          text-transform:uppercase;
          margin-bottom:16px;
        }
        .lp-price-amount {
          display:flex;
          align-items:flex-end;
          gap:4px;
          margin-bottom:8px;
        }
        .lp-price-num {
          font-size:60px;
          font-weight:900;
          letter-spacing:-0.05em;
          color:#0F172A;
          line-height:1;
        }
        .lp-price-sub {
          font-size:16px;
          color:#64748B;
          font-weight:700;
          margin-bottom:10px;
        }
        .lp-price-desc {
          color:#475569;
          line-height:1.75;
          margin-bottom:20px;
          font-size:15px;
        }
        .lp-price-features {
          display:grid;
          gap:10px;
          margin-bottom:24px;
        }
        .lp-price-feature {
          display:flex;
          align-items:flex-start;
          gap:10px;
          font-size:14px;
          color:#334155;
          line-height:1.6;
        }
        .lp-check { color:#16A34A; font-weight:900; flex-shrink:0; }
        .lp-price-note {
          text-align:center;
          color:#64748B;
          font-size:13px;
          margin-top:14px;
          line-height:1.6;
        }

        /* ── FAQ ── */
        .lp-faq-grid {
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:14px;
        }
        .lp-faq-item {
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:16px;
          padding:20px;
          box-shadow:0 4px 14px rgba(15,23,42,0.04);
        }
        .lp-faq-q {
          font-weight:900;
          color:#0F172A;
          margin-bottom:8px;
          font-size:15px;
        }
        .lp-faq-a {
          color:#64748B;
          line-height:1.75;
          font-size:14px;
        }

        /* ── WEB DEV SERVICES ── */
        .lp-webdev {
          background: #FFFFFF;
          border: 1px solid #E5EAF2;
          border-radius: 22px;
          padding: 40px 44px;
          margin: 8px 0;
          box-shadow: 0 4px 16px rgba(15,23,42,0.05);
        }
        .lp-webdev-inner {
          display: grid;
          grid-template-columns: 1fr minmax(0,320px);
          gap: 48px;
          align-items: center;
        }
        .lp-webdev-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 20px;
        }
        .lp-webdev-pill {
          padding: 5px 12px;
          border-radius: 999px;
          background: #F1F5F9;
          border: 1px solid #E2E8F0;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }
        .lp-webdev-cta-box {
          background: linear-gradient(135deg, #0F1F35 0%, #1E3A5F 100%);
          border-radius: 18px;
          padding: 28px 24px;
          text-align: center;
        }
        .lp-webdev-cta-box h3 {
          color: #FFFFFF;
          font-size: 20px;
          font-weight: 900;
          margin: 0 0 8px;
          letter-spacing: -0.02em;
        }
        .lp-webdev-cta-box p {
          color: rgba(255,255,255,0.6);
          font-size: 14px;
          line-height: 1.65;
          margin: 0 0 20px;
        }
        @media (max-width: 860px) {
          .lp-webdev-inner { grid-template-columns: 1fr; gap: 28px; }
          .lp-webdev { padding: 28px 22px; }
        }

        /* ── BOTTOM CTA ── */
        .lp-cta {
          background:linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
          border-radius:22px;
          padding:44px 40px;
          text-align:center;
          margin-top:8px;
        }
        .lp-cta h2 {
          margin:0 0 12px;
          font-size:34px;
          font-weight:900;
          letter-spacing:-0.03em;
          color:#0F172A;
        }
        .lp-cta p {
          max-width:600px;
          margin:0 auto 24px;
          color:rgba(15,23,42,0.7);
          line-height:1.75;
          font-size:16px;
        }
        .lp-cta-actions {
          display:flex;
          gap:12px;
          justify-content:center;
          flex-wrap:wrap;
        }
        .lp-btn-dark {
          display:inline-flex;
          align-items:center;
          justify-content:center;
          height:50px;
          padding:0 28px;
          border-radius:12px;
          background:#0F172A;
          color:#FFFFFF;
          font-weight:800;
          font-size:15px;
          text-decoration:none;
          cursor:pointer;
        }
        .lp-btn-dark:hover { filter:brightness(1.15); text-decoration:none; }
        .lp-btn-outline-dark {
          display:inline-flex;
          align-items:center;
          justify-content:center;
          height:50px;
          padding:0 24px;
          border-radius:12px;
          background:transparent;
          border:2px solid rgba(15,23,42,0.3);
          color:#0F172A;
          font-weight:700;
          font-size:15px;
          text-decoration:none;
          cursor:pointer;
        }
        .lp-btn-outline-dark:hover { background:rgba(15,23,42,0.08); text-decoration:none; }

        /* ── RESPONSIVE ── */
        @media (max-width:1050px) {
          .lp-hero-inner { grid-template-columns:1fr; gap:32px; }
          .lp-pricing-wrap { grid-template-columns:1fr; }
        }
        @media (max-width:860px) {
          .lp-feature-grid,
          .lp-step-grid { grid-template-columns:1fr 1fr; }
          .lp-faq-grid { grid-template-columns:1fr; }
        }
        @media (max-width:640px) {
          .lp-hero { padding:32px 22px 28px; border-radius:18px; }
          .lp-h1 { font-size:34px; }
          .lp-hero-copy { font-size:15px; }
          .lp-hero-actions { flex-direction:column; }
          .lp-btn-primary, .lp-btn-ghost { width:100%; }
          .lp-feature-grid, .lp-step-grid { grid-template-columns:1fr; }
          .lp-steps { padding:28px 20px; border-radius:18px; }
          .lp-section-h2 { font-size:26px; }
          .lp-pricing-card { padding:22px; }
          .lp-price-num { font-size:46px; }
          .lp-cta { padding:32px 22px; border-radius:18px; }
          .lp-cta h2 { font-size:26px; }
          .lp-cta-actions { flex-direction:column; align-items:stretch; }
          .lp-btn-dark, .lp-btn-outline-dark { width:100%; }
          .lp-stats-grid { grid-template-columns:1fr 1fr; }
        }
      `}</style>

      <div class="lp">

        {/* ── HERO ── */}
        <section class="lp-hero">
          <div class="lp-hero-inner">
            <div>
              <div class="lp-eyebrow">Construction operations platform</div>
              <h1 class="lp-h1">
                Run your business with <span>cleaner numbers</span> and faster workflows.
              </h1>
              <p class="lp-hero-copy">
                {appName} helps construction companies track jobs, labor, invoices, and
                profitability in one professional system — built for owner-operators and growing teams.
              </p>
              <div class="lp-hero-actions">
                <a href="/signup" class="lp-btn-primary">Get Started Free</a>
                <a href="/try-demo" class="lp-btn-ghost">Try the Demo</a>
                <a href="/pick-tenant" class="lp-btn-ghost" style="font-size:13px; height:40px; padding:0 16px;">Find My Workspace</a>
              </div>
            </div>

            <div class="lp-hero-panel">
              <div class="lp-stats-grid">
                <div class="lp-stat">
                  <div class="lp-stat-icon">📋</div>
                  <div class="lp-stat-label">Job Costing</div>
                  <div class="lp-stat-value">Clear</div>
                </div>
                <div class="lp-stat">
                  <div class="lp-stat-icon">⏱</div>
                  <div class="lp-stat-label">Time Tracking</div>
                  <div class="lp-stat-value">Simple</div>
                </div>
                <div class="lp-stat">
                  <div class="lp-stat-icon">🧾</div>
                  <div class="lp-stat-label">Invoicing</div>
                  <div class="lp-stat-value">Faster</div>
                </div>
                <div class="lp-stat">
                  <div class="lp-stat-icon">📊</div>
                  <div class="lp-stat-label">Reporting</div>
                  <div class="lp-stat-value">Actionable</div>
                </div>
              </div>
              <div class="lp-hero-callout">
                <div class="lp-hero-callout-title">Built for day-to-day business control</div>
                <div class="lp-hero-callout-copy">
                  Jobs, labor, billing, and financial visibility tied together — replace scattered spreadsheets with one operating system.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section class="lp-section">
          <div class="lp-section-tag">Platform capabilities</div>
          <h2 class="lp-section-h2">Everything your team needs, in one place</h2>
          <p class="lp-section-copy">
            Centered around the workflows construction businesses actually use every week — no bloat, no missing pieces.
          </p>

          <div class="lp-feature-grid">
            <div class="lp-feature-card">
              <div class="lp-feature-icon">📋</div>
              <div class="lp-feature-title">Jobs & Project Finances</div>
              <div class="lp-feature-copy">Create jobs, record income and expenses, and monitor performance at the project level with full cost visibility.</div>
            </div>
            <div class="lp-feature-card">
              <div class="lp-feature-icon">👷</div>
              <div class="lp-feature-title">Employees & Labor Tracking</div>
              <div class="lp-feature-copy">Manage employee records, track time entries, and keep labor visibility tied directly to your job data.</div>
            </div>
            <div class="lp-feature-card">
              <div class="lp-feature-icon">🧾</div>
              <div class="lp-feature-title">Invoices & Payments</div>
              <div class="lp-feature-copy">Create professional invoices, record payments, and keep receivables organized so billing never slips through.</div>
            </div>
            <div class="lp-feature-card">
              <div class="lp-feature-icon">📊</div>
              <div class="lp-feature-title">Reports & Trends</div>
              <div class="lp-feature-copy">Review cash flow, invoice aging, job profitability rankings, and financial trends — no manual rollups required.</div>
            </div>
            <div class="lp-feature-card">
              <div class="lp-feature-icon">🚚</div>
              <div class="lp-feature-title">Fleet Management</div>
              <div class="lp-feature-copy">Track vehicles, maintenance schedules, fuel logs, and expiring documents across your entire fleet.</div>
            </div>
            <div class="lp-feature-card">
              <div class="lp-feature-icon">📱</div>
              <div class="lp-feature-title">Mobile-Ready</div>
              <div class="lp-feature-copy">Clock in, log expenses, and check job status from any device — your team stays connected from the field.</div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section class="lp-steps">
          <div class="lp-section-tag">Getting started</div>
          <h2 class="lp-section-h2">Up and running in minutes</h2>
          <p class="lp-section-copy">A clean first-run experience gets your workspace ready for real work fast.</p>

          <div class="lp-step-grid">
            <div class="lp-step">
              <div class="lp-step-num">1</div>
              <div class="lp-step-title">Create your workspace</div>
              <div class="lp-step-copy">Set up your company, admin account, invoice defaults, and basic business details in a few minutes.</div>
            </div>
            <div class="lp-step">
              <div class="lp-step-num">2</div>
              <div class="lp-step-title">Add your operating data</div>
              <div class="lp-step-copy">Start with jobs, employees, and invoices so the platform reflects your real workflow from day one.</div>
            </div>
            <div class="lp-step">
              <div class="lp-step-num">3</div>
              <div class="lp-step-title">Run and review</div>
              <div class="lp-step-copy">Use dashboards and reports to track profitability, billing, labor, and cash movement more confidently.</div>
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <div class="lp-pricing-wrap">
          <div>
            <div class="lp-section-tag">Pricing</div>
            <h2 class="lp-section-h2">Simple, transparent pricing</h2>
            <p class="lp-section-copy">
              One straightforward plan that gives your company full access to every feature — no tiers,
              no surprises, no per-seat fees that scale against you.
            </p>
            <p class="lp-section-copy" style="margin-top:-12px;">
              Owner-operators and growing construction teams can finally have the same kind of
              business visibility that larger companies rely on, without the enterprise price tag.
            </p>
          </div>

          <div class="lp-pricing-card">
            <div class="lp-price-tag">Standard Plan</div>
            <div class="lp-price-amount">
              <div class="lp-price-num">$49</div>
              <div class="lp-price-sub">/ month</div>
            </div>
            <p class="lp-price-desc">Everything you need to run a more organized, more profitable construction business.</p>
            <div class="lp-price-features">
              <div class="lp-price-feature"><span class="lp-check">✓</span><span>Your own isolated company workspace</span></div>
              <div class="lp-price-feature"><span class="lp-check">✓</span><span>Job costing and profitability tracking</span></div>
              <div class="lp-price-feature"><span class="lp-check">✓</span><span>Employee time tracking and labor visibility</span></div>
              <div class="lp-price-feature"><span class="lp-check">✓</span><span>Invoices, payments, and receivables</span></div>
              <div class="lp-price-feature"><span class="lp-check">✓</span><span>Fleet management and maintenance logs</span></div>
              <div class="lp-price-feature"><span class="lp-check">✓</span><span>Reports, dashboards, and CSV exports</span></div>
              <div class="lp-price-feature"><span class="lp-check">✓</span><span>Mobile app for field teams</span></div>
            </div>
            <a href="/signup" class="lp-btn-primary" style="width:100%;height:50px;font-size:16px;">Start Your Workspace</a>
            <div class="lp-price-note">No credit card required to get started. Cancel anytime.</div>
          </div>
        </div>

        {/* ── FAQ ── */}
        <section class="lp-section" style="padding-bottom:8px;">
          <div class="lp-section-tag">Questions</div>
          <h2 class="lp-section-h2">Common questions</h2>
          <p class="lp-section-copy">Everything most visitors need to know before signing up.</p>

          <div class="lp-faq-grid">
            <div class="lp-faq-item">
              <div class="lp-faq-q">Who is this built for?</div>
              <div class="lp-faq-a">Construction companies that want better financial and operational visibility without overly complex enterprise software. Owner-operators and small-to-mid teams.</div>
            </div>
            <div class="lp-faq-item">
              <div class="lp-faq-q">Do I get my own company workspace?</div>
              <div class="lp-faq-a">Yes. Each company has its own isolated workspace with its own users, settings, billing, and business data. Your data is never shared with other companies.</div>
            </div>
            <div class="lp-faq-item">
              <div class="lp-faq-q">Can my field team use it on mobile?</div>
              <div class="lp-faq-a">Yes. Employees can clock in, log time to jobs, and check their schedules from any phone or tablet. No app store download needed — it works in the browser.</div>
            </div>
            <div class="lp-faq-item">
              <div class="lp-faq-q">How do I get support?</div>
              <div class="lp-faq-a">Support and billing workflows are available inside the platform. You can also reach us through the contact page before you sign up.</div>
            </div>
          </div>
        </section>

        {/* ── WEB DEV SERVICES ── */}
        <section class="lp-webdev">
          <div class="lp-webdev-inner">
            <div>
              <div class="lp-section-tag">Also from Hudson Business Solutions</div>
              <h2 class="lp-section-h2">Need a professional website?</h2>
              <p class="lp-section-copy" style="margin-bottom:0;">
                We build clean, fast, professional websites for small businesses — from simple landing pages to full-featured sites with galleries, booking, and payments. Same team, same standards.
              </p>
              <div class="lp-webdev-pills">
                <span class="lp-webdev-pill">🏠 Business Sites</span>
                <span class="lp-webdev-pill">🖼️ Photo Galleries</span>
                <span class="lp-webdev-pill">📅 Booking Systems</span>
                <span class="lp-webdev-pill">💳 Payments</span>
                <span class="lp-webdev-pill">🔍 SEO Setup</span>
                <span class="lp-webdev-pill">🎨 Logo Design</span>
              </div>
            </div>
            <div class="lp-webdev-cta-box">
              <h3>Get a Website Built</h3>
              <p>Tell us about your project and we'll put together a custom estimate — no commitment required.</p>
              <a href="/website-request" class="lp-btn-primary" style="width:100%;height:46px;font-size:15px;">Request a Website →</a>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section class="lp-cta">
          <h2>Ready to get organized?</h2>
          <p>
            Start your workspace today and bring your jobs, labor, invoices, and reporting into one system built for construction.
          </p>
          <div class="lp-cta-actions">
            <a href="/signup" class="lp-btn-dark">Create Your Workspace</a>
            <a href="/try-demo" class="lp-btn-outline-dark">Try the Demo</a>
            <a href="/contact" class="lp-btn-outline-dark">Talk to Us</a>
          </div>
        </section>

      </div>
    </div>
  );
};

export default LandingPage;
