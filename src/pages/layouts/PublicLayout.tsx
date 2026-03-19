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

    html, body{
      margin:0;
      padding:0;
    }

    body{
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

    .public-shell{
      min-height:100vh;
      padding:32px 20px 24px;
    }

    .wrapper{
      width:min(1180px, 100%);
      margin:0 auto;
    }

    .brand{
      display:flex;
      align-items:center;
      justify-content:center;
      gap:14px;
      text-align:left;
      margin-bottom:28px;
    }

    .brand img{
      height:58px;
      width:58px;
      object-fit:contain;
      display:block;
      flex:0 0 58px;
    }

    .brand-copy h1{
      margin:0;
      font-size:28px;
      letter-spacing:-.3px;
      line-height:1.05;
    }

    .brand-copy p{
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
      line-height:1.6;
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

    input, select, textarea{
      width:100%;
      padding:11px 12px;
      border:1px solid var(--border);
      border-radius:12px;
      font-size:14px;
      background:#fff;
      outline:none;
    }

    input:focus, select:focus, textarea:focus{
      border-color:rgba(30,58,95,.35);
      box-shadow:0 0 0 4px rgba(30,58,95,.10);
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
      min-height:40px;
      padding:0 16px;
      border-radius:12px;
      border:1px solid var(--border);
      background:#fff;
      font-weight:700;
      font-size:14px;
      cursor:pointer;
      text-decoration:none;
      color:inherit;
      white-space:nowrap;
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
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:32px;
      padding:0 12px;
      border-radius:999px;
      font-size:13px;
      font-weight:700;
      border:1px solid var(--border);
      background:#fff;
      color:#334155;
    }

    .badge-bad{
      background:#FEF2F2;
      border:1px solid #FEE2E2;
      color:#991B1B;
    }

    .public-footer{
      padding:28px 0 8px;
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

    @media (max-width: 900px){
      .public-shell{
        padding:24px 16px 20px;
      }

      .wrapper{
        width:min(100%, 100%);
      }
    }

    @media (max-width: 640px){
      .brand{
        flex-direction:column;
        text-align:center;
        gap:10px;
        margin-bottom:22px;
      }

      .brand-copy{
        text-align:center;
      }

      .brand-copy h1{
        font-size:24px;
      }

      .brand-copy p{
        font-size:13px;
      }

      .card{
        padding:18px;
      }

      .actions{
        flex-direction:column;
        align-items:stretch;
      }

      .actions .btn,
      .actions button,
      .actions form{
        width:100%;
      }

      .btn{
        min-height:44px;
      }

      .row{
        flex-direction:column;
      }

      .row > *{
        min-width:0;
        width:100%;
      }
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
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="icon" type="image/png" href="/static/favicon.png" />
        <style dangerouslySetInnerHTML={{ __html: publicCss }} />
      </head>
      <body>
        <div class="public-shell">
          <div class="wrapper">
            <div class="brand">
              <img src={appLogo} alt="Hudson Business Solutions Logo" />
              <div class="brand-copy">
                <h1>{displayAppName}</h1>
                <p>Construction finances, job costing, timesheets, and invoicing.</p>
              </div>
            </div>

            {children}

            <div class="public-footer">
              <div>© {year} {displayAppName}</div>
              <div class="public-footer-links">
                <a href="/terms">Terms of Service</a>
                <a href="/privacy">Privacy Policy</a>
                <a href="/contact">Contact</a>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
};

export default PublicLayout;