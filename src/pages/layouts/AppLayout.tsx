import type { FC } from 'hono/jsx';
import { getBillingBanner } from '../../services/billing-banner.js';
import { describeRole, hasPermission } from '../../services/permissions.js';

interface AppLayoutProps {
  currentTenant:
    | {
        id: number;
        name: string;
        subdomain: string;
        logo_path: string | null;
        billing_exempt?: number;
        billing_status?: string;
        billing_plan?: string | null;
        billing_trial_ends_at?: string | null;
        billing_grace_ends_at?: string | null;
      }
    | null;
  currentSubdomain: string | null;
  currentUser:
    | {
        id: number;
        name: string;
        email: string;
        role: string;
        permissions?: string[];
      }
    | null;
  appName: string;
  appLogo: string;
  path: string;
  csrfToken: string;
  subtitle?: string;
  children: any;
}

const appCss = `
    :root{
      --navy:#1E3A5F;
      --yellow:#F59E0B;
      --bg:#F5F7FB;
      --card:#FFFFFF;
      --border:#E5EAF2;
      --text:#0F172A;
      --muted:#64748B;
      --shadow: 0 10px 26px rgba(15,23,42,.08);
      --radius: 16px;
    }

    *{ box-sizing:border-box; }

    body{
      margin:0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
    }

    a{
      color: inherit;
      text-decoration:none;
    }

    a:hover{
      text-decoration:underline;
    }

    .layout{
      display:flex;
      min-height:100vh;
    }

    .sidebar{
      width:260px;
      background:var(--navy);
      color:white;
      padding:18px 14px;
      display:flex;
      flex-direction:column;
      gap:10px;
      flex:0 0 260px;
    }

    .brand{
      display:flex;
      align-items:center;
      gap:14px;
      padding:14px 14px;
      border-radius:14px;
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.10);
      min-height:84px;
    }

    .brand img{
      height:56px;
      width:56px;
      object-fit:contain;
      display:block;
      border-radius:12px;
      background:white;
      padding:4px;
      flex:0 0 56px;
    }

    .brand strong{
      font-size:18px;
      letter-spacing:.2px;
      line-height:1.1;
    }

    .brand span{
      display:block;
      font-size:12px;
      opacity:.85;
      margin-top:4px;
    }

    .nav{
      margin-top:8px;
      display:flex;
      flex-direction:column;
      gap:6px;
    }

    .nav a{
      padding:10px 12px;
      border-radius:12px;
      color:rgba(255,255,255,.90);
      font-weight:800;
      font-size:13px;
      display:flex;
      align-items:center;
      gap:10px;
    }

    .nav a:hover{
      background:rgba(255,255,255,.08);
      text-decoration:none;
    }

    .nav a.active{
      background:rgba(245,158,11,.18);
      border:1px solid rgba(245,158,11,.25);
      color:#fff;
    }

    .spacer{
      flex:1;
    }

    .side-foot{
      padding:10px 12px;
      border-radius:14px;
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.10);
      font-size:12px;
      opacity:.9;
    }

    .main{
      flex:1;
      display:flex;
      flex-direction:column;
      min-width:0;
    }

    .topbar{
      min-height:62px;
      background:var(--card);
      border-bottom:1px solid var(--border);
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:10px 18px;
    }

    .tenant{
      display:flex;
      flex-direction:column;
      line-height:1.15;
      min-width:0;
    }

    .tenant strong{
      font-size:14px;
    }

    .tenant span{
      font-size:12px;
      color:var(--muted);
      word-break:break-word;
    }

    .top-actions{
      display:flex;
      align-items:center;
      gap:10px;
      flex-wrap:wrap;
    }

    .btn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:36px;
      padding:0 12px;
      border-radius:12px;
      border:1px solid var(--border);
      background:#fff;
      font-weight:900;
      font-size:13px;
      cursor:pointer;
      text-decoration:none;
      white-space:nowrap;
    }

    .btn-primary{
      background:var(--navy);
      color:white;
      border-color:transparent;
    }

    .btn-primary:hover{
      filter:brightness(1.06);
      text-decoration:none;
    }

    .content{
      flex:1;
      padding:18px;
    }

    .container{
      width:min(1200px, 100%);
      margin:0 auto;
    }

    .page-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:16px;
      margin:6px 0 16px;
    }

    .page-head h1{
      margin:0;
      font-size:22px;
      letter-spacing:-.3px;
    }

    .page-head p{
      margin:6px 0 0;
      color:var(--muted);
    }

    .grid{
      display:grid;
      gap:14px;
    }

    .grid-2{
      grid-template-columns:repeat(2, minmax(0,1fr));
    }

    .grid-3{
      grid-template-columns:repeat(3, minmax(0,1fr));
    }

    .grid-4{
      grid-template-columns:repeat(4, minmax(0,1fr));
    }

    @media (max-width:980px){
      .grid-4{
        grid-template-columns:repeat(2, minmax(0,1fr));
      }
    }

    @media (max-width:760px){
      .layout{
        flex-direction:column;
      }

      .sidebar{
        width:100%;
        flex:0 0 auto;
        padding:14px 12px;
      }

      .brand{
        min-height:auto;
        padding:12px;
      }

      .brand img{
        height:48px;
        width:48px;
        flex-basis:48px;
      }

      .nav{
        flex-direction:row;
        overflow:auto;
        padding-bottom:2px;
        margin-top:6px;
      }

      .nav a{
        flex:0 0 auto;
        white-space:nowrap;
      }

      .side-foot{
        margin-top:6px;
      }

      .topbar{
        align-items:flex-start;
        flex-direction:column;
        padding:12px 14px;
      }

      .top-actions{
        width:100%;
      }

      .top-actions .btn{
        width:100%;
      }

      .content{
        padding:14px;
      }

      .page-head{
        flex-direction:column;
      }

      .grid-2,
      .grid-3,
      .grid-4{
        grid-template-columns:1fr;
      }
    }

    .card{
      background:var(--card);
      border:1px solid var(--border);
      border-radius:var(--radius);
      box-shadow:var(--shadow);
      padding:16px;
      min-width:0;
    }

    .table-wrap{
      overflow:auto;
      -webkit-overflow-scrolling:touch;
    }

    table{
      width:100%;
      border-collapse:separate;
      border-spacing:0;
    }

    th{
      text-align:left;
      font-size:12px;
      color:var(--muted);
      padding:10px 12px;
      border-bottom:1px solid var(--border);
      white-space:nowrap;
    }

    td{
      padding:12px;
      border-bottom:1px solid var(--border);
      vertical-align:top;
    }

    tr:last-child td{
      border-bottom:none;
    }

    .right{
      text-align:right;
    }

    label{
      display:block;
      font-size:12px;
      font-weight:900;
      margin:12px 0 6px;
      color:#334155;
    }

    input, select, textarea{
      width:100%;
      padding:11px 12px;
      border:1px solid var(--border);
      border-radius:12px;
      font-size:14px;
      outline:none;
      background:#fff;
    }

    input:focus, select:focus, textarea:focus{
      border-color:rgba(30,58,95,.35);
      box-shadow:0 0 0 4px rgba(30,58,95,.10);
    }

    .row{
      display:flex;
      gap:12px;
      align-items:flex-end;
    }

    .row > *{
      flex:1;
      min-width:0;
    }

    @media (max-width:760px){
      .row{
        flex-direction:column;
        align-items:stretch;
      }
    }

    .muted{
      color:var(--muted);
    }

    .badge{
      display:inline-flex;
      align-items:center;
      min-height:22px;
      padding:0 10px;
      border-radius:999px;
      border:1px solid var(--border);
      background:#F8FAFC;
      font-size:12px;
      font-weight:900;
      color:#334155;
      white-space:nowrap;
    }

    .badge-warn{
      background:#FFFBEB;
      border-color:#FEF3C7;
      color:#92400E;
    }

    .badge-good{
      background:#ECFDF5;
      border-color:#D1FAE5;
      color:#065F46;
    }

    .badge-bad{
      background:#FEF2F2;
      border-color:#FEE2E2;
      color:#991B1B;
    }

    .actions{
      display:flex;
      gap:10px;
      align-items:center;
      flex-wrap:wrap;
    }

    @media (max-width:760px){
      .actions{
        width:100%;
        align-items:stretch;
      }

      .actions > .btn,
      .actions > a.btn,
      .actions > form{
        width:100%;
      }
    }

    .billing-banner{
      margin-bottom:14px;
      border-radius:16px;
      border:1px solid var(--border);
      box-shadow:var(--shadow);
      padding:14px 16px;
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:14px;
    }

    .billing-banner strong{
      display:block;
      font-size:14px;
      margin-bottom:4px;
    }

    .billing-banner p{
      margin:0;
      color:inherit;
      line-height:1.45;
      font-size:13px;
    }

    .billing-banner-info{
      background:#EFF6FF;
      border-color:#BFDBFE;
      color:#1D4ED8;
    }

    .billing-banner-warn{
      background:#FFFBEB;
      border-color:#FDE68A;
      color:#92400E;
    }

    .billing-banner-bad{
      background:#FEF2F2;
      border-color:#FECACA;
      color:#991B1B;
    }

    .billing-banner .btn{
      white-space:nowrap;
      flex:0 0 auto;
    }

    .permission-chip-list{
      display:flex;
      flex-wrap:wrap;
      gap:6px;
      margin-top:6px;
    }

    .permission-chip{
      display:inline-flex;
      align-items:center;
      min-height:24px;
      padding:0 10px;
      border-radius:999px;
      background:rgba(255,255,255,.08);
      border:1px solid rgba(255,255,255,.12);
      font-size:11px;
      font-weight:800;
      color:rgba(255,255,255,.92);
    }

    .list{
      display:grid;
      gap:10px;
    }

    .list-item{
      padding:12px 14px;
      border:1px solid var(--border);
      border-radius:14px;
      background:#fff;
    }

    .app-footer{
      border-top:1px solid var(--border);
      background:#FFFFFF;
      padding:16px 18px 20px;
    }

    .app-footer-inner{
      width:min(1200px, 100%);
      margin:0 auto;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      flex-wrap:wrap;
      color:var(--muted);
      font-size:13px;
    }

    .app-footer-links{
      display:flex;
      align-items:center;
      gap:14px;
      flex-wrap:wrap;
    }

    .app-footer-links a{
      color:var(--muted);
    }

    .app-footer-links a:hover{
      color:var(--navy);
      text-decoration:none;
    }

    @media (max-width:760px){
      .billing-banner{
        flex-direction:column;
        align-items:flex-start;
      }

      .billing-banner .btn{
        width:100%;
      }

      .app-footer-inner{
        flex-direction:column;
        align-items:flex-start;
      }
    }
  `;

const pageshowScript = `
    window.addEventListener("pageshow", function (event) {
      if (event.persisted) {
        window.location.reload();
      }
    });
`;

function isActive(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern === '/' && path === '/') return true;
    if (pattern !== '/' && path.startsWith(pattern)) return true;
  }
  return false;
}

function buildNavItems(currentUser: AppLayoutProps['currentUser']) {
  const permissions = currentUser?.permissions ?? [];

  return [
    { label: 'Dashboard', href: '/', patterns: ['/'], visible: true },
    {
      label: 'Jobs',
      href: '/jobs',
      patterns: ['/jobs', '/add_job', '/job/', '/edit_job/'],
      visible: hasPermission(permissions, 'jobs.view'),
    },
    {
      label: 'Reports',
      href: '/reports',
      patterns: ['/reports', '/profit', '/job_costs'],
      visible: hasPermission(permissions, 'reports.view'),
    },
    {
      label: 'Employees',
      href: '/employees',
      patterns: ['/employees', '/add_employee', '/edit_employee/'],
      visible: hasPermission(permissions, 'employees.view'),
    },
    {
      label: 'Timesheets',
      href: '/timesheet',
      patterns: ['/timesheet'],
      visible: hasPermission(permissions, 'time.view'),
    },
    {
      label: 'Invoices',
      href: '/invoices',
      patterns: ['/invoices', '/add_invoice', '/invoice/'],
      visible: hasPermission(permissions, 'invoices.view'),
    },
    {
      label: 'Activity',
      href: '/activity',
      patterns: ['/activity'],
      visible: hasPermission(permissions, 'activity.view'),
    },
    {
      label: 'Support',
      href: '/support',
      patterns: ['/support'],
      visible: !!currentUser,
    },
    {
      label: 'Users',
      href: '/users',
      patterns: ['/users', '/add_user', '/edit_user/'],
      visible: hasPermission(permissions, 'users.view'),
    },
    {
      label: 'Billing',
      href: '/billing',
      patterns: ['/billing'],
      visible: hasPermission(permissions, 'billing.view'),
    },
    {
      label: 'Settings',
      href: '/settings',
      patterns: ['/settings'],
      visible: hasPermission(permissions, 'settings.view'),
    },
  ].filter((item) => item.visible);
}

function billingBadgeClass(tenant: AppLayoutProps['currentTenant']): string {
  if (!tenant) return 'badge';
  if (Number(tenant.billing_exempt || 0) === 1) return 'badge badge-good';
  const status = String(tenant.billing_status || 'trialing').toLowerCase();
  if (status === 'active' || status === 'internal') return 'badge badge-good';
  if (status === 'past_due') return 'badge badge-warn';
  return 'badge badge-bad';
}

function billingBadgeLabel(tenant: AppLayoutProps['currentTenant']): string {
  if (!tenant) return 'No Tenant';
  if (Number(tenant.billing_exempt || 0) === 1) return 'Billing Exempt';
  return String(tenant.billing_status || 'trialing')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function billingBannerClass(tone: 'info' | 'warn' | 'bad'): string {
  if (tone === 'bad') return 'billing-banner billing-banner-bad';
  if (tone === 'warn') return 'billing-banner billing-banner-warn';
  return 'billing-banner billing-banner-info';
}

function buildPermissionSummary(currentUser: AppLayoutProps['currentUser']): string[] {
  const permissions = currentUser?.permissions ?? [];
  const chips: string[] = [];

  if (hasPermission(permissions, 'settings.manage')) chips.push('Settings Control');
  if (hasPermission(permissions, 'users.edit')) chips.push('User Management');
  if (hasPermission(permissions, 'financials.edit')) chips.push('Financial Editing');
  if (hasPermission(permissions, 'time.approve')) chips.push('Time Approval');
  if (hasPermission(permissions, 'billing.manage')) chips.push('Billing Control');

  if (chips.length === 0 && hasPermission(permissions, 'time.clock')) {
    chips.push('Time Clock Access');
  }

  return chips.slice(0, 4);
}

export const AppLayout: FC<AppLayoutProps> = ({
  currentTenant,
  currentSubdomain,
  currentUser,
  appName,
  appLogo,
  path,
  subtitle,
  children,
}) => {
  const titlePrefix = currentTenant ? `${currentTenant.name} | ` : '';
  const displayAppName = appName || 'Hudson Business Solutions';
  const billingBanner = getBillingBanner(currentTenant);
  const navItems = buildNavItems(currentUser);
  const permissionSummary = buildPermissionSummary(currentUser);
  const year = new Date().getFullYear();

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{titlePrefix}{displayAppName}</title>
        <link rel="stylesheet" href="/static/css/app.css" />
        <link rel="icon" type="image/png" href="/static/favicon.png" />
        <style dangerouslySetInnerHTML={{ __html: appCss }} />
      </head>
      <body>
        <div class="layout">
          <aside class="sidebar">
            <div class="brand">
              <img src={appLogo} alt="Hudson Business Solutions" />
              <div>
                <strong>{displayAppName}</strong>
                <span>{currentTenant ? currentTenant.name : 'Workspace'}</span>
              </div>
            </div>

            <nav class="nav">
              {navItems.map((item) => (
                <a
                  class={isActive(path, item.patterns) ? 'active' : undefined}
                  href={item.href}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div class="spacer"></div>

            <div class="side-foot">
              <div><b>Tenant:</b> {currentSubdomain ? currentSubdomain : 'none'}</div>
              <div style="margin-top:8px;">
                <span class={billingBadgeClass(currentTenant)}>{billingBadgeLabel(currentTenant)}</span>
              </div>
              {currentUser ? (
                <>
                  <div style="margin-top:10px;"><b>Role:</b> {currentUser.role}</div>
                  <div style="margin-top:4px; opacity:.9;">{describeRole(currentUser.role)}</div>
                  {permissionSummary.length ? (
                    <div class="permission-chip-list">
                      {permissionSummary.map((item) => (
                        <span class="permission-chip">{item}</span>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </aside>

          <main class="main">
            <header class="topbar">
              <div class="tenant">
                <strong>{currentTenant ? currentTenant.name : 'Hudson Business Solutions'}</strong>
                <span>{subtitle || ''}</span>
              </div>

              <div class="top-actions">
                {currentUser ? (
                  <a class="btn" href="/logout">Logout</a>
                ) : null}
              </div>
            </header>

            <div class="content">
              <div class="container">
                {billingBanner && path !== '/billing' ? (
                  <div class={billingBannerClass(billingBanner.tone)}>
                    <div>
                      <strong>{billingBanner.title}</strong>
                      <p>{billingBanner.message}</p>
                    </div>
                    <a class="btn" href="/billing">Manage Billing</a>
                  </div>
                ) : null}

                {children}
              </div>
            </div>

            <footer class="app-footer">
              <div class="app-footer-inner">
                <div>© {year} {displayAppName}</div>
                <div class="app-footer-links">
                  <a href="/terms">Terms of Service</a>
                  <a href="/privacy">Privacy Policy</a>
                  <a href="/contact">Contact</a>
                </div>
              </div>
            </footer>
          </main>
        </div>

        <script dangerouslySetInnerHTML={{ __html: pageshowScript }} />
      </body>
    </html>
  );
};

export default AppLayout;