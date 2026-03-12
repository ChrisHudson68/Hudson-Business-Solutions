import type { FC } from 'hono/jsx';

interface AppLayoutProps {
  currentTenant: { id: number; name: string; subdomain: string; logo_path: string | null } | null;
  currentSubdomain: string | null;
  currentUser: { id: number; name: string; email: string; role: string } | null;
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
      height:62px;
      background:var(--card);
      border-bottom:1px solid var(--border);
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:0 18px;
    }

    .tenant{
      display:flex;
      flex-direction:column;
      line-height:1.15;
    }

    .tenant strong{
      font-size:14px;
    }

    .tenant span{
      font-size:12px;
      color:var(--muted);
    }

    .top-actions{
      display:flex;
      align-items:center;
      gap:10px;
    }

    .btn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      height:36px;
      padding:0 12px;
      border-radius:12px;
      border:1px solid var(--border);
      background:#fff;
      font-weight:900;
      font-size:13px;
      cursor:pointer;
      text-decoration:none;
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
    }

    .row > *{
      flex:1;
    }

    .muted{
      color:var(--muted);
    }

    .badge{
      display:inline-flex;
      align-items:center;
      height:22px;
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

const navItems = [
  { label: 'Dashboard', href: '/', patterns: ['/'] },
  { label: 'Jobs', href: '/jobs', patterns: ['/jobs', '/add_job', '/job/', '/edit_job/'] },
  { label: 'Employees', href: '/employees', patterns: ['/employees', '/add_employee', '/edit_employee/'] },
  { label: 'Timesheets', href: '/timesheet', patterns: ['/timesheet'] },
  { label: 'Invoices', href: '/invoices', patterns: ['/invoices', '/add_invoice', '/invoice/'] },
  { label: 'Users', href: '/users', patterns: ['/users', '/add_user', '/edit_user/'] },
  { label: 'Settings', href: '/settings', patterns: ['/settings'] },
];

export const AppLayout: FC<AppLayoutProps> = ({
  currentTenant,
  currentSubdomain,
  currentUser,
  appName,
  appLogo,
  path,
  csrfToken,
  subtitle,
  children,
}) => {
  const titlePrefix = currentTenant ? `${currentTenant.name} | ` : '';
  const displayAppName = appName || 'Hudson Business Solutions';

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{titlePrefix}{displayAppName}</title>
        <link rel="stylesheet" href="/static/css/app.css" />
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
              <b>Tenant:</b> {currentSubdomain ? currentSubdomain : 'none'}
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
                {children}
              </div>
            </div>
          </main>
        </div>

        <script dangerouslySetInnerHTML={{ __html: pageshowScript }} />
      </body>
    </html>
  );
};

export default AppLayout;
