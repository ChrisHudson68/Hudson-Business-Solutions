import type { FC } from 'hono/jsx';

interface AdminLayoutProps {
  currentAdmin: { email: string } | null;
  appName: string;
  path: string;
  subtitle?: string;
  children: any;
}

const adminCss = `
  :root{
    --navy:#1E3A5F;
    --yellow:#F59E0B;
    --bg:#F5F7FB;
    --card:#FFFFFF;
    --border:#E5EAF2;
    --text:#0F172A;
    --muted:#64748B;
    --shadow:0 10px 26px rgba(15,23,42,.08);
    --radius:16px;
  }

  *{ box-sizing:border-box; }

  body{
    margin:0;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    background:var(--bg);
    color:var(--text);
  }

  a{
    color:inherit;
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
    width:280px;
    background:var(--navy);
    color:#fff;
    padding:18px 14px;
    display:flex;
    flex-direction:column;
    gap:10px;
  }

  .brand{
    padding:16px 14px;
    border-radius:14px;
    background:rgba(255,255,255,.06);
    border:1px solid rgba(255,255,255,.10);
  }

  .brand strong{
    display:block;
    font-size:18px;
    line-height:1.1;
  }

  .brand span{
    display:block;
    font-size:12px;
    opacity:.85;
    margin-top:6px;
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
    color:rgba(255,255,255,.92);
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
    padding:12px;
    border-radius:14px;
    background:rgba(255,255,255,.06);
    border:1px solid rgba(255,255,255,.10);
    font-size:12px;
    line-height:1.5;
    opacity:.92;
  }

  .main{
    flex:1;
    display:flex;
    flex-direction:column;
    min-width:0;
  }

  .topbar{
    height:64px;
    background:var(--card);
    border-bottom:1px solid var(--border);
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0 18px;
  }

  .topbar strong{
    display:block;
    font-size:14px;
  }

  .topbar span{
    display:block;
    font-size:12px;
    color:var(--muted);
    margin-top:4px;
  }

  .top-actions{
    display:flex;
    align-items:center;
    gap:10px;
  }

  .content{
    padding:18px;
  }

  .container{
    width:min(1280px, 100%);
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

  .card{
    background:var(--card);
    border:1px solid var(--border);
    border-radius:var(--radius);
    box-shadow:var(--shadow);
    padding:16px;
    min-width:0;
  }

  .stat-label{
    font-size:12px;
    color:var(--muted);
    font-weight:800;
    text-transform:uppercase;
    letter-spacing:.05em;
  }

  .stat-value{
    font-size:30px;
    font-weight:900;
    margin-top:8px;
  }

  .muted{
    color:var(--muted);
  }

  .badge{
    display:inline-flex;
    align-items:center;
    height:24px;
    padding:0 10px;
    border-radius:999px;
    border:1px solid var(--border);
    background:#F8FAFC;
    font-size:12px;
    font-weight:900;
    color:#334155;
    white-space:nowrap;
  }

  .badge-good{
    background:#ECFDF5;
    border-color:#D1FAE5;
    color:#065F46;
  }

  .badge-warn{
    background:#FFFBEB;
    border-color:#FDE68A;
    color:#92400E;
  }

  .badge-bad{
    background:#FEF2F2;
    border-color:#FECACA;
    color:#991B1B;
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
    color:inherit;
  }

  .btn-primary{
    background:var(--navy);
    color:#fff;
    border-color:transparent;
  }

  .btn-primary:hover{
    filter:brightness(1.06);
    text-decoration:none;
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
`;

function isActive(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => path === pattern || path.startsWith(`${pattern}/`));
}

const navItems = [
  { label: 'Overview', href: '/admin', patterns: ['/admin'] },
  { label: 'Tenants', href: '/admin/tenants', patterns: ['/admin/tenants'] },
];

export const AdminLayout: FC<AdminLayoutProps> = ({
  currentAdmin,
  appName,
  path,
  subtitle,
  children,
}) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{appName} Platform Admin</title>
        <link rel="stylesheet" href="/static/css/app.css" />
        <link rel="icon" type="image/png" href="/static/favicon.png" />
        <style dangerouslySetInnerHTML={{ __html: adminCss }} />
      </head>
      <body>
        <div class="layout">
          <aside class="sidebar">
            <div class="brand">
              <strong>{appName}</strong>
              <span>Platform Admin Portal</span>
            </div>

            <nav class="nav">
              {navItems.map((item) => (
                <a
                  href={item.href}
                  class={isActive(path, item.patterns) ? 'active' : ''}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div class="spacer" />

            <div class="side-foot">
              <div><strong>Signed in as</strong></div>
              <div>{currentAdmin?.email || 'Unknown admin'}</div>
              <div style="margin-top:10px;">
                <a href="/" style="color:#fff;">Back to main site</a>
              </div>
              <div style="margin-top:8px;">
                <a href="/admin/logout" style="color:#fff;">Log out</a>
              </div>
            </div>
          </aside>

          <main class="main">
            <div class="topbar">
              <div>
                <strong>Owner Control Panel</strong>
                <span>{subtitle || 'Cross-tenant operational visibility'}</span>
              </div>

              <div class="top-actions">
                <a class="btn" href="/">Main Site</a>
                <a class="btn btn-primary" href="/admin/tenants">View Tenants</a>
              </div>
            </div>

            <div class="content">
              <div class="container">{children}</div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
};

export default AdminLayout;