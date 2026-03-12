import type { FC } from 'hono/jsx';

interface PublicLayoutProps {
  appName: string;
  appLogo: string;
  children: any;
}

const publicCss = `
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
      color:var(--navy);
    }

    a:hover{
      text-decoration:none;
    }

    .wrapper{
      width:100%;
      max-width:820px;
      margin:60px auto;
      padding:0 16px;
    }

    .brand{
      text-align:center;
      margin-bottom:28px;
    }

    .brand img{
      height:56px;
      width:auto;
      display:block;
      margin:0 auto 10px;
    }

    .brand h1{
      margin:0;
      font-size:28px;
      letter-spacing:-.3px;
    }

    .brand p{
      margin:6px 0 0;
      color:var(--muted);
      font-size:14px;
    }

    .page-head{
      text-align:center;
      margin-bottom:18px;
    }

    .page-head h1{
      margin:0;
      font-size:26px;
    }

    .page-head p{
      margin:6px 0 0;
      color:var(--muted);
    }

    .card{
      background:var(--card);
      border:1px solid var(--border);
      border-radius:var(--radius);
      box-shadow:var(--shadow);
      padding:24px;
      width:100%;
      max-width:100%;
      margin:0 auto;
    }

    label{
      display:block;
      font-size:13px;
      font-weight:700;
      margin:14px 0 6px;
      color:#334155;
    }

    input, select{
      width:100%;
      padding:11px 12px;
      border:1px solid var(--border);
      border-radius:12px;
      font-size:14px;
      background:#fff;
    }

    input:focus, select:focus{
      border-color:rgba(30,58,95,.35);
      box-shadow:0 0 0 4px rgba(30,58,95,.10);
      outline:none;
    }

    .row{
      display:flex;
      gap:12px;
      flex-wrap:wrap;
    }

    .row > *{
      flex:1;
      min-width:220px;
    }

    .actions{
      display:flex;
      gap:10px;
      margin-top:18px;
      flex-wrap:wrap;
      justify-content:center;
    }

    .btn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      height:36px;
      padding:0 16px;
      border-radius:12px;
      border:1px solid var(--border);
      background:#fff;
      font-weight:700;
      font-size:13px;
      cursor:pointer;
      text-decoration:none;
      color:inherit;
    }

    .btn-primary{
      background:var(--navy);
      color:white;
      border-color:transparent;
    }

    .btn-primary:hover{
      filter:brightness(1.05);
      text-decoration:none;
    }

    .muted{
      color:var(--muted);
      font-size:13px;
      text-align:center;
    }

    .badge{
      display:block;
      padding:10px 12px;
      margin-bottom:16px;
      border-radius:12px;
      font-size:13px;
      font-weight:700;
    }

    .badge-bad{
      background:#FEF2F2;
      border:1px solid #FEE2E2;
      color:#991B1B;
    }

    .public-footer{
      padding:24px 0 8px;
      text-align:center;
      color:var(--muted);
      font-size:13px;
    }

    .public-footer-links{
      display:flex;
      justify-content:center;
      gap:14px;
      flex-wrap:wrap;
      margin-top:8px;
    }
`;

export const PublicLayout: FC<PublicLayoutProps> = ({
  appName,
  appLogo,
  children,
}) => {
  const displayAppName = appName || 'Hudson Business Solutions';
  const year = new Date().getFullYear();

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Hudson Business Solutions</title>
        <style dangerouslySetInnerHTML={{ __html: publicCss }} />
      </head>
      <body>
        <div class="wrapper">
          <div class="brand">
            <img src={appLogo} alt="Hudson Business Solutions Logo" />
            <h1>{displayAppName}</h1>
            <p>Construction finances, job costing, timesheets, and invoicing.</p>
          </div>

          {children}

          <div class="public-footer">
            <div>© {year} {displayAppName}</div>
            <div class="public-footer-links">
              <a href="/terms">Terms of Service</a>
              <a href="/privacy">Privacy Policy</a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
};

export default PublicLayout;