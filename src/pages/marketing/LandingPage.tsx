import type { FC } from 'hono/jsx';

interface LandingPageProps {
  appName: string;
  appLogo: string;
}

export const LandingPage: FC<LandingPageProps> = ({
  appName,
  appLogo,
}) => {
  const year = new Date().getFullYear();

  return (
    <div>
      <section
        style="
          padding: 36px 0 22px;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 28px;
          align-items: center;
        "
      >
        <div>
          <div
            style="
              display:flex;
              align-items:center;
              gap:14px;
              margin-bottom:16px;
            "
          >
            <img
              src={appLogo}
              alt={appName}
              style="width:56px; height:56px; object-fit:contain;"
            />
            <div>
              <div
                style="
                  font-size:12px;
                  font-weight:800;
                  letter-spacing:0.12em;
                  text-transform:uppercase;
                  color:#64748B;
                "
              >
                Construction Operations Platform
              </div>
              <div
                style="
                  font-size:36px;
                  font-weight:900;
                  line-height:1.05;
                  color:#0F172A;
                "
              >
                {appName}
              </div>
            </div>
          </div>

          <h1
            style="
              font-size:46px;
              line-height:1.05;
              margin:0 0 16px;
              color:#0F172A;
              font-weight:900;
              max-width:720px;
            "
          >
            Construction finances, job costing, timesheets, and invoicing in one place.
          </h1>

          <p
            style="
              font-size:18px;
              line-height:1.65;
              color:#475569;
              margin:0 0 24px;
              max-width:700px;
            "
          >
            {appName} helps construction teams track jobs, labor, expenses, invoices,
            payments, and profitability with a clean tenant-based workspace built for
            real operations.
          </p>

          <div
            style="
              display:flex;
              gap:12px;
              flex-wrap:wrap;
              margin-bottom:18px;
            "
          >
            <a href="/signup" class="btn btn-primary" style="padding:12px 18px; font-size:15px;">
              Get Started
            </a>
            <a href="/pick-tenant" class="btn" style="padding:12px 18px; font-size:15px;">
              Sign In
            </a>
          </div>

          <div
            style="
              display:flex;
              gap:10px;
              flex-wrap:wrap;
              margin-top:10px;
            "
          >
            <span class="badge">Multi-tenant</span>
            <span class="badge">Job Costing</span>
            <span class="badge">Timesheets</span>
            <span class="badge">Invoices</span>
            <span class="badge">Payments</span>
            <span class="badge">Profit Tracking</span>
          </div>
        </div>

        <div>
          <div
            class="card"
            style="
              padding:20px;
              border-radius:18px;
              box-shadow:0 20px 50px rgba(15,23,42,0.08);
            "
          >
            <div
              style="
                display:grid;
                grid-template-columns:repeat(2, minmax(0,1fr));
                gap:14px;
              "
            >
              <div class="card" style="margin:0;">
                <div class="muted" style="font-size:12px; font-weight:800;">Open Receivables</div>
                <div style="font-size:28px; font-weight:900; margin-top:8px;">$48,320</div>
                <div class="muted" style="margin-top:6px; font-size:12px;">7 unpaid invoices</div>
              </div>

              <div class="card" style="margin:0;">
                <div class="muted" style="font-size:12px; font-weight:800;">Labor This Month</div>
                <div style="font-size:28px; font-weight:900; margin-top:8px;">$12,640</div>
                <div class="muted" style="margin-top:6px; font-size:12px;">Tracked by timesheets</div>
              </div>

              <div class="card" style="margin:0;">
                <div class="muted" style="font-size:12px; font-weight:800;">Active Jobs</div>
                <div style="font-size:28px; font-weight:900; margin-top:8px;">18</div>
                <div class="muted" style="margin-top:6px; font-size:12px;">Across all crews</div>
              </div>

              <div class="card" style="margin:0;">
                <div class="muted" style="font-size:12px; font-weight:800;">Portfolio Profit</div>
                <div style="font-size:28px; font-weight:900; margin-top:8px;">$92,410</div>
                <div class="muted" style="margin-top:6px; font-size:12px;">Income minus costs</div>
              </div>
            </div>

            <div
              style="
                margin-top:16px;
                padding:14px 16px;
                border:1px solid #E5EAF2;
                border-radius:14px;
                background:#F8FAFC;
              "
            >
              <div style="font-weight:800; color:#0F172A; margin-bottom:6px;">
                Built for the way contractors work
              </div>
              <div class="muted" style="line-height:1.6;">
                Track job budgets, incoming cash, outgoing costs, employee labor, and
                invoice balances without bouncing between spreadsheets and disconnected tools.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style="padding: 10px 0 8px;">
        <div class="grid grid-3">
          <div class="card">
            <div style="font-weight:900; font-size:18px; margin-bottom:8px;">Job Costing</div>
            <div class="muted" style="line-height:1.7;">
              Monitor contract value, expenses, labor cost, retainage, and profitability by job.
            </div>
          </div>

          <div class="card">
            <div style="font-weight:900; font-size:18px; margin-bottom:8px;">Weekly Timesheets</div>
            <div class="muted" style="line-height:1.7;">
              Log labor by employee and job with automatic labor cost calculation built in.
            </div>
          </div>

          <div class="card">
            <div style="font-weight:900; font-size:18px; margin-bottom:8px;">Invoices &amp; Payments</div>
            <div class="muted" style="line-height:1.7;">
              Create invoices, track collections, monitor overdue balances, and stay on top of receivables.
            </div>
          </div>
        </div>
      </section>

      <section style="padding: 10px 0 6px;">
        <div class="card">
          <div style="font-weight:900; font-size:24px; margin-bottom:16px;">
            How {appName} works
          </div>

          <div class="grid grid-3">
            <div>
              <div
                style="
                  width:36px;
                  height:36px;
                  border-radius:999px;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  font-weight:900;
                  background:#0F172A;
                  color:white;
                  margin-bottom:10px;
                "
              >
                1
              </div>
              <div style="font-weight:800; margin-bottom:6px;">Create your workspace</div>
              <div class="muted" style="line-height:1.7;">
                Set up your company, branding, invoice defaults, and admin account.
              </div>
            </div>

            <div>
              <div
                style="
                  width:36px;
                  height:36px;
                  border-radius:999px;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  font-weight:900;
                  background:#0F172A;
                  color:white;
                  margin-bottom:10px;
                "
              >
                2
              </div>
              <div style="font-weight:800; margin-bottom:6px;">Track jobs and labor</div>
              <div class="muted" style="line-height:1.7;">
                Add jobs, employees, timesheets, income, and expenses as the work happens.
              </div>
            </div>

            <div>
              <div
                style="
                  width:36px;
                  height:36px;
                  border-radius:999px;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  font-weight:900;
                  background:#0F172A;
                  color:white;
                  margin-bottom:10px;
                "
              >
                3
              </div>
              <div style="font-weight:800; margin-bottom:6px;">Bill and monitor cash flow</div>
              <div class="muted" style="line-height:1.7;">
                Send invoices, log payments, and keep an eye on receivables and profit.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style="padding: 12px 0 0;">
        <div
          class="card"
          style="
            text-align:center;
            padding:28px 20px;
          "
        >
          <div style="font-size:28px; font-weight:900; margin-bottom:10px;">
            Ready to run your company with better visibility?
          </div>

          <div
            class="muted"
            style="
              max-width:760px;
              margin:0 auto 18px;
              line-height:1.7;
            "
          >
            Start a new workspace or sign in to your existing company account.
          </div>

          <div
            style="
              display:flex;
              justify-content:center;
              gap:12px;
              flex-wrap:wrap;
            "
          >
            <a href="/signup" class="btn btn-primary" style="padding:12px 18px;">
              Get Started
            </a>
            <a href="/pick-tenant" class="btn" style="padding:12px 18px;">
              Sign In
            </a>
          </div>
        </div>
      </section>

      <footer
        style="
          padding:24px 0 6px;
          color:#64748B;
          font-size:13px;
          text-align:center;
        "
      >
        <div>© {year} {appName}. Built for construction operations.</div>
        <div style="margin-top:8px; display:flex; justify-content:center; gap:14px; flex-wrap:wrap;">
          <a href="/terms">Terms of Service</a>
          <a href="/privacy">Privacy Policy</a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;