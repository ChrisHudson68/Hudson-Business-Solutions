import type { FC } from 'hono/jsx';

interface LandingPageProps {
  appName: string;
  appLogo: string;
}

export const LandingPage: FC<LandingPageProps> = ({ appName, appLogo }) => {
  const year = new Date().getFullYear();

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
          margin:0 0 18px;
          letter-spacing:-0.03em;
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

        .landing-mini-note{
          margin-top:14px;
          color:#64748B;
          font-size:13px;
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
          .landing-feature-grid,
          .landing-step-grid{
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
            line-height:1.4;
          }

          .landing-title{
            font-size:36px;
            line-height:1.05;
            margin-bottom:12px;
          }

          .landing-copy{
            font-size:16px;
            line-height:1.7;
            margin-bottom:18px;
          }

          .landing-actions{
            flex-direction:column;
            align-items:stretch;
          }

          .landing-actions .btn{
            width:100%;
          }

          .landing-tags{
            gap:8px;
          }

          .landing-tags .badge{
            width:100%;
            justify-content:center;
          }

          .landing-showcase{
            padding:16px;
            border-radius:18px;
          }

          .landing-showcase-grid{
            grid-template-columns:1fr;
          }

          .landing-stat{
            padding:14px;
          }

          .landing-stat-value{
            font-size:24px;
          }

          .landing-feature-card,
          .landing-steps{
            padding:18px;
          }

          .landing-section-title{
            font-size:24px;
            margin-bottom:14px;
          }

          .landing-bottom-title{
            font-size:26px;
          }

          .landing-bottom-copy{
            font-size:15px;
          }
        }
      `}</style>

      <div class="landing-page">
        <section class="landing-hero">
          <div>
            <div class="landing-eyebrow">Construction Operations Platform</div>

            <div class="landing-brand">
              <img src={appLogo} alt={appName} />
              <div>
                <div class="landing-brand-title">{appName}</div>
                <div class="landing-brand-sub">
                  Construction finances, job costing, timesheets, invoicing, and profitability
                </div>
              </div>
            </div>

            <h1 class="landing-title">
              Run your construction business from one clean workspace.
            </h1>

            <p class="landing-copy">
              Hudson Business Solutions helps contractors track jobs, labor, expenses, invoices,
              payments, and profitability in a tenant-based system built for real field and office workflows.
            </p>

            <div class="landing-actions">
              <a href="/signup" class="btn btn-primary">Get Started</a>
              <a href="/pick-tenant" class="btn">Sign In</a>
            </div>

            <div class="landing-tags">
              <span class="badge">Multi-tenant</span>
              <span class="badge">Job Costing</span>
              <span class="badge">Timesheets</span>
              <span class="badge">Invoices</span>
              <span class="badge">Payments</span>
              <span class="badge">Profit Tracking</span>
            </div>
          </div>

          <div class="landing-showcase">
            <div class="landing-showcase-grid">
              <div class="landing-stat">
                <div class="landing-stat-label">Open Receivables</div>
                <div class="landing-stat-value">$48,320</div>
                <div class="landing-stat-sub">7 unpaid invoices</div>
              </div>

              <div class="landing-stat">
                <div class="landing-stat-label">Labor This Month</div>
                <div class="landing-stat-value">$12,640</div>
                <div class="landing-stat-sub">Tracked by timesheets</div>
              </div>

              <div class="landing-stat">
                <div class="landing-stat-label">Active Jobs</div>
                <div class="landing-stat-value">18</div>
                <div class="landing-stat-sub">Across all crews</div>
              </div>

              <div class="landing-stat">
                <div class="landing-stat-label">Portfolio Profit</div>
                <div class="landing-stat-value">$92,410</div>
                <div class="landing-stat-sub">Income minus labor and expenses</div>
              </div>
            </div>

            <div class="landing-callout">
              <div class="landing-callout-title">Built for the way contractors actually work</div>
              <div class="landing-callout-copy">
                Track job budgets, incoming cash, outgoing costs, employee labor, and invoice
                balances without living in spreadsheets or disconnected tools.
              </div>
            </div>
          </div>
        </section>

        <section class="landing-feature-grid">
          <div class="landing-feature-card">
            <div class="landing-feature-title">Job Costing</div>
            <div class="landing-feature-copy">
              Monitor contract value, expenses, labor cost, retainage, and profitability by job.
            </div>
          </div>

          <div class="landing-feature-card">
            <div class="landing-feature-title">Weekly Timesheets</div>
            <div class="landing-feature-copy">
              Log labor by employee and job with automatic labor cost calculation built in.
            </div>
          </div>

          <div class="landing-feature-card">
            <div class="landing-feature-title">Invoices & Payments</div>
            <div class="landing-feature-copy">
              Create invoices, track collections, monitor overdue balances, and stay on top of receivables.
            </div>
          </div>
        </section>

        <section class="landing-steps">
          <h2 class="landing-section-title">How Hudson Business Solutions works</h2>

          <div class="landing-step-grid">
            <div class="landing-step">
              <div class="landing-step-number">1</div>
              <div class="landing-step-title">Create your workspace</div>
              <div class="landing-step-copy">
                Set up your company, branding, invoice defaults, and admin account.
              </div>
            </div>

            <div class="landing-step">
              <div class="landing-step-number">2</div>
              <div class="landing-step-title">Run daily operations</div>
              <div class="landing-step-copy">
                Track jobs, labor, costs, invoices, and collections inside one system built for your team.
              </div>
            </div>

            <div class="landing-step">
              <div class="landing-step-number">3</div>
              <div class="landing-step-title">See the financial picture</div>
              <div class="landing-step-copy">
                Review profitability, receivables, and job performance without piecing together reports by hand.
              </div>
            </div>
          </div>
        </section>

        <section class="landing-bottom">
          <h2 class="landing-bottom-title">Built for owner-operators and growing construction teams</h2>
          <p class="landing-bottom-copy">
            Whether you are managing a handful of jobs or scaling into a larger operation,
            Hudson Business Solutions gives you a cleaner way to control job costing, labor tracking,
            billing, and visibility across the business.
          </p>

          <div class="landing-actions" style="justify-content:center;">
            <a href="/signup" class="btn btn-primary">Create Workspace</a>
            <a href="/pick-tenant" class="btn">Find My Workspace</a>
          </div>

          <div class="landing-mini-note">
            © {year} {appName}
          </div>
        </section>
      </div>
    </div>
  );
};

export default LandingPage;