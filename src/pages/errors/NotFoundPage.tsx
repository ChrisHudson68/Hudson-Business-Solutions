import type { FC } from 'hono/jsx';

const notFoundCss = `
    body{
      margin:0;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
      background:#F5F7FB;
      color:#0F172A;
      display:flex;
      align-items:center;
      justify-content:center;
      min-height:100vh;
      padding:24px;
    }
    .card{
      width:min(560px,100%);
      background:#fff;
      border:1px solid #E5EAF2;
      border-radius:16px;
      box-shadow:0 10px 26px rgba(15,23,42,.08);
      padding:28px;
      text-align:center;
    }
    h1{
      margin:0 0 10px;
      font-size:28px;
      color:#1E3A5F;
    }
    p{
      margin:0 0 18px;
      color:#64748B;
      line-height:1.6;
    }
    a{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      height:40px;
      padding:0 16px;
      border-radius:12px;
      background:#1E3A5F;
      color:#fff;
      font-weight:800;
      text-decoration:none;
    }
`;

export const NotFoundPage: FC = () => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Page Not Found | Hudson Business Solutions</title>
        <style dangerouslySetInnerHTML={{ __html: notFoundCss }} />
      </head>
      <body>
        <div class="card">
          <h1>Page not found</h1>
          <p>The page you were trying to reach does not exist or may have been moved.</p>
          <a href="/">Return to Dashboard</a>
        </div>
      </body>
    </html>
  );
};

export default NotFoundPage;
