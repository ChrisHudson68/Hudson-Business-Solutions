import type { FC } from 'hono/jsx';

interface LandingPageProps {
  appName: string;
  appLogo: string;
}

export const LandingPage: FC<LandingPageProps> = ({ appName, appLogo }) => {
  return (
    <div>
      <style>{`
        .landing-page{
          display:flex;
          flex-direction:column;
          gap:18px;
        }

        .landing-hero{
          display:grid;
          grid-template-columns:minmax(0, 1.08fr) minmax(340px, 0.92fr);
          gap:28px;
          align-items:center;
          padding:10px 0 6px;
        }

        .landing-eyebrow{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:8px 12px;
          border-radius:999px;
          border:1px solid #DBEAFE;
          background:#EFF6FF;
          color:#1D4ED8;
          font-size:12px;
          font-weight:800;
          letter-spacing:.08em;
          text-transform:uppercase;
          margin-bottom:14px;
        }

        .landing-brand{
          display:flex;
          align-items:center;
          gap:14px;
          margin-bottom:18px;
        }

        .landing-brand img{
          width:60px;
          height:60px;
          object-fit:contain;
          flex:0 0 60px;
        }

        .landing-brand-title{
          font-size:36px;
          line-height:1.02;
          font-weight:900;
          letter-spacing:-0.03em;
          color:#0F172A;
        }

        .landing-brand-sub{
          margin-top:6px;
          color:#64748B;
          font-size:13px;
          font-weight:700;
          letter-spacing:.06em;
          text-transform:uppercase;
        }

        .landing-title{
          margin:0 0 16px;
          font-size:52px;
          line-height:1.02;
          letter-spacing:-0.04em;
          color:#0F172A;
          font-weight:900;
          max-width:760px;
        }

        .landing-copy{
          margin:0 0 24px;
          font-size:18px;
          line-height:1.75;
          color:#475569;
          max-width:720px;
        }

        .landing-actions{
          display:flex;
          gap:12px;
          flex-wrap:wrap;
          margin-bottom:18px;
        }

        .landing-actions .btn{
          min-height:46px;
          padding:0 18px;
          font-size:15px;
        }

        .landing-tags{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
        }

        .landing-showcase{
          background:linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
          border:1px solid #E5EAF2;
          border-radius:22px;
          box-shadow:0 20px 50px rgba(15,23,42,0.08);
          padding:20px;
        }

        .landing-showcase-grid{
          display:grid;
          grid-template-columns:repeat(2, minmax(0, 1fr));
          gap:14px;
        }

        .landing-stat{
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:16px;
          padding:16px;
          box-shadow:0 8px 20px rgba(15,23,42,0.05);
        }

        .landing-stat-label{
          color:#64748B;
          font-size:12px;
          font-weight:800;
          text-transform:uppercase;
          letter-spacing:.05em;
        }

        .landing-stat-value{
          font-size:29px;
          font-weight:900;
          letter-spacing:-0.03em;
          margin-top:8px;
          color:#0F172A;
        }

        .landing-stat-sub{
          color:#64748B;
          font-size:12px;
          margin-top:6px;
          line-height:1.5;
        }

        .landing-callout{
          margin-top:16px;
          padding:15px 16px;
          border:1px solid #E5EAF2;
          border-radius:16px;
          background:#F8FAFC;
        }

        .landing-callout-title{
          font-weight:900;
          color:#0F172A;
          margin-bottom:6px;
        }

        .landing-callout-copy{
          color:#64748B;
          line-height:1.7;
        }

        .landing-value-grid{
          display:grid;
          grid-template-columns:repeat(3, minmax(0,1fr));
          gap:16px;
        }

        .landing-feature-grid{
          display:grid;
          grid-template-columns:repeat(3, minmax(0,1fr));
          gap:16px;
        }

        .landing-feature-card{
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:18px;
          box-shadow:0 10px 24px rgba(15,23,42,0.06);
          padding:20px;
        }

        .landing-feature-title{
          font-weight:900;
          font-size:18px;
          margin-bottom:8px;
          color:#0F172A;
        }

        .landing-feature-copy{
          color:#64748B;
          line-height:1.75;
        }

        .landing-trust{
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:20px;
          box-shadow:0 10px 24px rgba(15,23,42,0.06);
          padding:24px;
        }

        .landing-trust-grid{
          display:grid;
          grid-template-columns:repeat(3, minmax(0,1fr));
          gap:16px;
          margin-top:16px;
        }

        .landing-trust-item{
          border:1px solid #E5EAF2;
          background:#F8FAFC;
          border-radius:16px;
          padding:18px;
        }

        .landing-trust-title{
          font-weight:900;
          color:#0F172A;
          margin-bottom:8px;
        }

        .landing-trust-copy{
          color:#64748B;
          line-height:1.75;
        }

        .landing-pricing{
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:20px;
          box-shadow:0 10px 24px rgba(15,23,42,0.06);
          padding:24px;
        }

        .landing-pricing-header{
          text-align:center;
          margin-bottom:20px;
        }

        .landing-pricing-title{
          margin:0 0 10px;
          font-weight:900;
          font-size:28px;
          color:#0F172A;
          letter-spacing:-0.03em;
        }

        .landing-pricing-copy{
          max-width:760px;
          margin:0 auto;
          color:#64748B;
          line-height:1.8;
          font-size:16px;
        }

        .landing-pricing-grid{
          display:grid;
          grid-template-columns:minmax(0, 1fr);
          justify-content:center;
        }

        .landing-pricing-card{
          max-width:520px;
          margin:0 auto;
          background:linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
          border:2px solid #1E3A5F;
          border-radius:22px;
          box-shadow:0 16px 34px rgba(15,23,42,0.08);
          padding:24px;
        }

        .landing-pricing-plan{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          padding:8px 12px;
          border-radius:999px;
          background:#EFF6FF;
          border:1px solid #DBEAFE;
          color:#1D4ED8;
          font-size:12px;
          font-weight:800;
          text-transform:uppercase;
          letter-spacing:.08em;
          margin-bottom:14px;
        }

        .landing-pricing-price{
          display:flex;
          align-items:flex-end;
          justify-content:center;
          gap:6px;
          margin-bottom:8px;
        }

        .landing-pricing-price-main{
          font-size:56px;
          line-height:1;
          font-weight:900;
          letter-spacing:-0.04em;
          color:#0F172A;
        }

        .landing-pricing-price-sub{
          font-size:15px;
          color:#64748B;
          font-weight:700;
          margin-bottom:8px;
        }

        .landing-pricing-description{
          text-align:center;
          color:#475569;
          line-height:1.8;
          margin-bottom:18px;
        }

        .landing-pricing-features{
          display:grid;
          gap:10px;
          margin-bottom:20px;
        }

        .landing-pricing-feature{
          display:flex;
          align-items:flex-start;
          gap:10px;
          color:#334155;
          line-height:1.7;
        }

        .landing-pricing-check{
          color:#15803D;
          font-weight:900;
          flex:0 0 auto;
        }

        .landing-pricing-note{
          text-align:center;
          color:#64748B;
          font-size:13px;
          line-height:1.6;
          margin-top:14px;
        }

        .landing-steps{
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:20px;
          box-shadow:0 10px 24px rgba(15,23,42,0.06);
          padding:24px;
        }

        .landing-section-title{
          font-weight:900;
          font-size:28px;
          color:#0F172A;
          margin:0 0 8px;
          letter-spacing:-0.03em;
        }

        .landing-section-copy{
          color:#64748B;
          line-height:1.8;
          margin:0 0 18px;
        }

        .landing-step-grid{
          display:grid;
          grid-template-columns:repeat(3, minmax(0,1fr));
          gap:18px;
        }

        .landing-step{
          min-width:0;
        }

        .landing-step-number{
          width:40px;
          height:40px;
          border-radius:999px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight:900;
          background:#0F172A;
          color:#FFFFFF;
          margin-bottom:12px;
        }

        .landing-step-title{
          font-weight:800;
          margin-bottom:6px;
          color:#0F172A;
        }

        .landing-step-copy{
          color:#64748B;
          line-height:1.75;
        }

        .landing-faq{
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:20px;
          box-shadow:0 10px 24px rgba(15,23,42,0.06);
          padding:24px;
        }

        .landing-faq-grid{
          display:grid;
          grid-template-columns:repeat(2, minmax(0,1fr));
          gap:16px;
        }

        .landing-faq-item{
          border:1px solid #E5EAF2;
          border-radius:16px;
          background:#F8FAFC;
          padding:18px;
        }

        .landing-faq-question{
          font-weight:900;
          color:#0F172A;
          margin-bottom:8px;
        }

        .landing-faq-answer{
          color:#64748B;
          line-height:1.75;
        }

        .landing-bottom{
          text-align:center;
          padding:10px 0 4px;
        }

        .landing-bottom-title{
          margin:0 0 10px;
          font-size:30px;
          line-height:1.15;
          font-weight:900;
          letter-spacing:-0.03em;
          color:#0F172A;
        }

        .landing-bottom-copy{
          max-width:760px;
          margin:0 auto 18px;
          color:#64748B;
          line-height:1.8;
          font-size:16px;
        }

        @media (max-width: 1050px){
          .landing-hero{
            grid-template-columns:1fr;
          }

          .landing-title{
            max-width:none;
          }
        }

        @media (max-width: 900px){
          .landing-value-grid,
          .landing-feature-grid,
          .landing-trust-grid,
          .landing-step-grid,
          .landing-faq-grid{
            grid-template-columns:1fr;
          }

          .landing-showcase-grid{
            grid-template-columns:1fr 1fr;
          }
        }

        @media (max-width: 640px){
          .landing-page{
            gap:16px;
          }

          .landing-hero{
            gap:18px;
            padding:0;
          }

          .landing-brand{
            align-items:flex-start;
            gap:12px;
            margin-bottom:14px;
          }

          .landing-brand img{
            width:52px;
            height:52px;
            flex-basis:52px;
          }

          .landing-brand-title{
            font-size:28px;
          }

          .landing-brand-sub{
            font-size:12px;
          }

          .landing-title{
            font-size:36px;
            margin-bottom:12px;
          }

          .landing-copy{
            font-size:16px;
            margin-bottom:18px;
          }

          .landing-actions{
            flex-direction:column;
            align-items:stretch;
          }

          .landing-actions .btn{
            width:100%;
          }

          .landing-showcase{
            padding:16px;
          }

          .landing-showcase-grid{
            grid-template-columns:1fr;
          }

          .landing-section-title,
          .landing-pricing-title{
            font-size:24px;
          }

          .landing-pricing-card,
          .landing-steps,
          .landing-trust,
          .landing-faq{
            padding:18px;
          }

          .landing-pricing-price-main{
            font-size:44px;
          }

          .landing-bottom-title{
            font-size:25px;
          }
        }
      `}</style>

      <div class="landing-page">
        <section class="landing-hero">
          <div>
            <div class="landing-eyebrow">Construction software built for real operations</div>

            <div class="landing-brand">
              <img src={appLogo} alt={`${appName} logo`} />
              <div>
                <div class="landing-brand-title">{appName}</div>
                <div class="landing-brand-sub">Job costing • Labor tracking • Invoicing • Reporting</div>
              </div>
            </div>

            <h1 class="landing-title">
              Run your construction business with cleaner numbers, faster workflows, and better visibility.
            </h1>

            <p class="landing-copy">
              Hudson Business Solutions helps construction companies track jobs, labor, invoices, payments,
              and profitability in one professional system. Replace disconnected spreadsheets and scattered
              processes with a workspace built for owner-operators and growing teams.
            </p>

            <div class="landing-actions">
              <a href="/signup" class="btn btn-primary">Create Workspace</a>
              <a href="/pick-tenant" class="btn">Find My Workspace</a>
              <a href="/contact" class="btn">Contact Us</a>
            </div>

            <div class="landing-tags">
              <span class="badge">Multi-tenant SaaS</span>
              <span class="badge">Cloud-based</span>
              <span class="badge">Mobile-friendly</span>
              <span class="badge">Construction-focused</span>
            </div>
          </div>

          <div class="landing-showcase">
            <div class="landing-showcase-grid">
              <div class="landing-stat">
                <div class="landing-stat-label">Job Costing</div>
                <div class="landing-stat-value">Clear</div>
                <div class="landing-stat-sub">Track financial performance by job without juggling separate files.</div>
              </div>

              <div class="landing-stat">
                <div class="landing-stat-label">Time Tracking</div>
                <div class="landing-stat-value">Simple</div>
                <div class="landing-stat-sub">Capture employee time and labor impact inside the same platform.</div>
              </div>

              <div class="landing-stat">
                <div class="landing-stat-label">Invoicing</div>
                <div class="landing-stat-value">Faster</div>
                <div class="landing-stat-sub">Generate invoices and monitor payments and receivables in one place.</div>
              </div>

              <div class="landing-stat">
                <div class="landing-stat-label">Reporting</div>
                <div class="landing-stat-value">Actionable</div>
                <div class="landing-stat-sub">See trends, profitability, and cash movement without manual reporting work.</div>
              </div>
            </div>

            <div class="landing-callout">
              <div class="landing-callout-title">Built for day-to-day business control</div>
              <div class="landing-callout-copy">
                The goal is not more software to manage. The goal is a cleaner operating system for your company:
                jobs, labor, billing, and financial visibility tied together in one place.
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 class="landing-section-title">Why companies switch</h2>
          <p class="landing-section-copy">
            Most small construction teams do not need bloated enterprise software. They need dependable workflows,
            easier billing, and a better view of what is happening across jobs and cash flow.
          </p>

          <div class="landing-value-grid">
            <div class="landing-feature-card">
              <div class="landing-feature-title">Less spreadsheet dependence</div>
              <div class="landing-feature-copy">
                Bring jobs, employees, invoices, expenses, and payments into one workspace instead of chasing information across files and messages.
              </div>
            </div>

            <div class="landing-feature-card">
              <div class="landing-feature-title">Better owner visibility</div>
              <div class="landing-feature-copy">
                See job profitability, receivables, labor cost impact, and financial trends without waiting for manual rollups.
              </div>
            </div>

            <div class="landing-feature-card">
              <div class="landing-feature-title">Cleaner day-to-day operations</div>
              <div class="landing-feature-copy">
                Give admins and managers a more consistent process for entering work, reviewing data, and keeping the business organized.
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 class="landing-section-title">Core platform capabilities</h2>
          <p class="landing-section-copy">
            Everything is centered around the workflows construction businesses actually use every week.
          </p>

          <div class="landing-feature-grid">
            <div class="landing-feature-card">
              <div class="landing-feature-title">Jobs and project finances</div>
              <div class="landing-feature-copy">
                Create jobs, record income and expenses, and monitor performance at the project level.
              </div>
            </div>

            <div class="landing-feature-card">
              <div class="landing-feature-title">Employees and labor tracking</div>
              <div class="landing-feature-copy">
                Manage employee records, track time entries, and keep labor visibility tied to your operational data.
              </div>
            </div>

            <div class="landing-feature-card">
              <div class="landing-feature-title">Invoices and payments</div>
              <div class="landing-feature-copy">
                Create invoices, record payments, and keep receivables organized so billing stays visible.
              </div>
            </div>

            <div class="landing-feature-card">
              <div class="landing-feature-title">Reports and trends</div>
              <div class="landing-feature-copy">
                Review cash flow, invoice aging, rankings, profitability, and trend reporting from inside the platform.
              </div>
            </div>

            <div class="landing-feature-card">
              <div class="landing-feature-title">Company setup and branding</div>
              <div class="landing-feature-copy">
                Configure company details, invoice defaults, and branding so your workspace feels production-ready from day one.
              </div>
            </div>

            <div class="landing-feature-card">
              <div class="landing-feature-title">Support and billing tools</div>
              <div class="landing-feature-copy">
                Access billing controls and in-app support workflows without leaving the platform.
              </div>
            </div>
          </div>
        </section>

        <section class="landing-trust">
          <h2 class="landing-section-title">Professional from the start</h2>
          <p class="landing-section-copy">
            Hudson Business Solutions is designed to feel like a real business system, not a rough internal tool.
          </p>

          <div class="landing-trust-grid">
            <div class="landing-trust-item">
              <div class="landing-trust-title">Secure account-based access</div>
              <div class="landing-trust-copy">
                Each company operates in its own workspace with its own users, settings, and subscription status.
              </div>
            </div>

            <div class="landing-trust-item">
              <div class="landing-trust-title">Owner and manager visibility</div>
              <div class="landing-trust-copy">
                Built to support decision-making, not just data entry, with reporting and operational oversight built in.
              </div>
            </div>

            <div class="landing-trust-item">
              <div class="landing-trust-title">Support-ready platform</div>
              <div class="landing-trust-copy">
                Billing and support workflows are built directly into the product to help teams resolve issues quickly.
              </div>
            </div>
          </div>
        </section>

        <section class="landing-pricing">
          <div class="landing-pricing-header">
            <h2 class="landing-pricing-title">Simple launch pricing</h2>
            <p class="landing-pricing-copy">
              Clear pricing helps reduce hesitation and makes it easier for companies to understand how to get started.
            </p>
          </div>

          <div class="landing-pricing-grid">
            <div class="landing-pricing-card">
              <div style="text-align:center;">
                <div class="landing-pricing-plan">Standard plan</div>
              </div>

              <div class="landing-pricing-price">
                <div class="landing-pricing-price-main">$49</div>
                <div class="landing-pricing-price-sub">/ month</div>
              </div>

              <div class="landing-pricing-description">
                A professional starting point for construction businesses that want better control over job costing,
                labor tracking, invoicing, and reporting.
              </div>

              <div class="landing-pricing-features">
                <div class="landing-pricing-feature">
                  <span class="landing-pricing-check">✔</span>
                  <span>One company workspace with isolated data and settings</span>
                </div>
                <div class="landing-pricing-feature">
                  <span class="landing-pricing-check">✔</span>
                  <span>Job costing and profitability tracking</span>
                </div>
                <div class="landing-pricing-feature">
                  <span class="landing-pricing-check">✔</span>
                  <span>Employee time tracking and labor visibility</span>
                </div>
                <div class="landing-pricing-feature">
                  <span class="landing-pricing-check">✔</span>
                  <span>Invoices, payments, and receivables visibility</span>
                </div>
                <div class="landing-pricing-feature">
                  <span class="landing-pricing-check">✔</span>
                  <span>Reports, dashboard visibility, and in-app support</span>
                </div>
              </div>

              <div class="landing-actions" style="justify-content:center; margin-bottom:0;">
                <a href="/signup" class="btn btn-primary">Create Workspace</a>
              </div>

              <div class="landing-pricing-note">
                Start with a clear monthly plan and move your operations into a more organized system.
              </div>
            </div>
          </div>
        </section>

        <section class="landing-steps">
          <h2 class="landing-section-title">How it works</h2>
          <p class="landing-section-copy">
            Getting started is straightforward and built around a clean first-run experience.
          </p>

          <div class="landing-step-grid">
            <div class="landing-step">
              <div class="landing-step-number">1</div>
              <div class="landing-step-title">Create your workspace</div>
              <div class="landing-step-copy">
                Set up your company, admin account, invoice defaults, and basic business details.
              </div>
            </div>

            <div class="landing-step">
              <div class="landing-step-number">2</div>
              <div class="landing-step-title">Add your operating data</div>
              <div class="landing-step-copy">
                Start with jobs, employees, and invoices so the platform can begin reflecting your real workflow.
              </div>
            </div>

            <div class="landing-step">
              <div class="landing-step-number">3</div>
              <div class="landing-step-title">Run and review</div>
              <div class="landing-step-copy">
                Use dashboards and reports to track profitability, billing, labor, and financial movement more confidently.
              </div>
            </div>
          </div>
        </section>

        <section class="landing-faq">
          <h2 class="landing-section-title">Common questions</h2>
          <p class="landing-section-copy">
            These are the questions most visitors usually need answered before signing up.
          </p>

          <div class="landing-faq-grid">
            <div class="landing-faq-item">
              <div class="landing-faq-question">Who is this built for?</div>
              <div class="landing-faq-answer">
                Hudson Business Solutions is designed for construction companies that want better financial and operational visibility without overly complex software.
              </div>
            </div>

            <div class="landing-faq-item">
              <div class="landing-faq-question">Do I get my own company workspace?</div>
              <div class="landing-faq-answer">
                Yes. Each company uses its own isolated workspace with its own users, settings, billing status, and business data.
              </div>
            </div>

            <div class="landing-faq-item">
              <div class="landing-faq-question">Can my team track labor and invoices in one place?</div>
              <div class="landing-faq-answer">
                Yes. The platform is designed to bring employees, time tracking, jobs, invoices, payments, and reporting together in one workflow.
              </div>
            </div>

            <div class="landing-faq-item">
              <div class="landing-faq-question">How do I get help if I run into an issue?</div>
              <div class="landing-faq-answer">
                Support and billing workflows are available inside the platform, and public contact information is also available before signup.
              </div>
            </div>
          </div>
        </section>

        <section class="landing-bottom">
          <h2 class="landing-bottom-title">A better operating system for your construction business</h2>
          <p class="landing-bottom-copy">
            If you want cleaner job costing, better billing visibility, and a more professional workflow for your team,
            Hudson Business Solutions gives you a strong place to start.
          </p>

          <div class="landing-actions" style="justify-content:center;">
            <a href="/signup" class="btn btn-primary">Create Workspace</a>
            <a href="/contact" class="btn">Talk to Us</a>
            <a href="/pick-tenant" class="btn">Find My Workspace</a>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LandingPage;