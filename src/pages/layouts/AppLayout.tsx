import type { FC } from 'hono/jsx';
import { getBillingBanner } from '../../services/billing-banner.js';
import { resolveEffectiveBillingState } from '../../services/billing-access.js';
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
        billing_state?: string | null;
        billing_grace_until?: string | null;
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
    --navy-dark:#0F1F35;
    --yellow:#F59E0B;
    --yellow-dark:#D97706;
    --bg:#F0F2F7;
    --card:#FFFFFF;
    --border:#E2E8F2;
    --text:#0F172A;
    --muted:#64748B;
    --shadow:0 2px 12px rgba(15,23,42,.07);
    --shadow-md:0 6px 24px rgba(15,23,42,.10);
    --radius:14px;
    --sidebar-width:248px;
  }

  *{ box-sizing:border-box; }

  body{
    margin:0;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    background:var(--bg);
    color:var(--text);
    font-size:14px;
    line-height:1.5;
  }

  a{ color:inherit; text-decoration:none; }
  a:hover{ text-decoration:none; }

  /* ── LAYOUT SHELL ── */
  .layout{
    display:flex;
    min-height:100vh;
  }

  /* ── SIDEBAR ── */
  .sidebar{
    width:var(--sidebar-width);
    background:linear-gradient(180deg, #0F1F35 0%, #1a3356 100%);
    color:white;
    display:flex;
    flex-direction:column;
    flex:0 0 var(--sidebar-width);
    position:sticky;
    top:0;
    height:100vh;
    overflow-y:auto;
    scrollbar-width:none;
  }

  .sidebar::-webkit-scrollbar{ display:none; }

  .sidebar-inner{
    display:flex;
    flex-direction:column;
    min-height:100%;
    padding:16px 12px;
    gap:4px;
  }

  /* Brand */
  .brand{
    display:flex;
    align-items:center;
    gap:10px;
    padding:12px 10px;
    border-radius:12px;
    background:rgba(255,255,255,.07);
    border:1px solid rgba(255,255,255,.10);
    margin-bottom:10px;
    text-decoration:none;
  }

  .brand:hover{ background:rgba(255,255,255,.10); text-decoration:none; }

  .brand-logo{
    height:40px;
    width:40px;
    object-fit:contain;
    border-radius:9px;
    background:white;
    padding:3px;
    flex:0 0 40px;
  }

  .brand-text strong{
    display:block;
    font-size:13px;
    font-weight:800;
    line-height:1.2;
    color:#fff;
  }

  .brand-text span{
    display:block;
    font-size:11px;
    color:rgba(255,255,255,.55);
    margin-top:2px;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    max-width:140px;
  }

  /* Nav section label */
  .nav-section{
    font-size:10px;
    font-weight:800;
    letter-spacing:.08em;
    text-transform:uppercase;
    color:rgba(255,255,255,.35);
    padding:10px 10px 4px;
  }

  /* Nav links */
  .nav{
    display:flex;
    flex-direction:column;
    gap:2px;
  }

  .nav a{
    display:flex;
    align-items:center;
    gap:9px;
    padding:9px 10px;
    border-radius:10px;
    color:rgba(255,255,255,.75);
    font-weight:600;
    font-size:13px;
    transition:background .12s, color .12s;
    border:1px solid transparent;
  }

  .nav a:hover{
    background:rgba(255,255,255,.07);
    color:#fff;
  }

  .nav a.active{
    background:rgba(245,158,11,.15);
    border-color:rgba(245,158,11,.22);
    color:#FCD34D;
    font-weight:700;
  }

  .nav-icon{
    width:26px;
    height:26px;
    border-radius:7px;
    background:rgba(255,255,255,.08);
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:13px;
    flex:0 0 26px;
    transition:background .12s;
  }

  .nav a.active .nav-icon{
    background:rgba(245,158,11,.25);
  }

  /* Spacer */
  .spacer{ flex:1; min-height:16px; }

  /* Sidebar footer */
  .side-foot{
    margin-top:auto;
    border-top:1px solid rgba(255,255,255,.08);
    padding-top:12px;
    display:flex;
    flex-direction:column;
    gap:10px;
  }

  .side-user{
    display:flex;
    align-items:center;
    gap:10px;
    padding:10px;
    border-radius:10px;
    background:rgba(255,255,255,.06);
    border:1px solid rgba(255,255,255,.09);
  }

  .side-avatar{
    width:34px;
    height:34px;
    border-radius:8px;
    background:linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:13px;
    font-weight:800;
    color:#0F172A;
    flex:0 0 34px;
  }

  .side-user-info{
    min-width:0;
    flex:1;
  }

  .side-user-name{
    font-size:12px;
    font-weight:700;
    color:#fff;
    line-height:1.2;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }

  .side-user-role{
    font-size:11px;
    color:rgba(255,255,255,.50);
    margin-top:1px;
  }

  .side-billing{
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0 2px;
  }

  .side-tenant-label{
    font-size:11px;
    color:rgba(255,255,255,.40);
  }

  .side-logout{
    display:flex;
    align-items:center;
    justify-content:center;
    gap:6px;
    padding:8px 10px;
    border-radius:10px;
    background:rgba(255,255,255,.05);
    border:1px solid rgba(255,255,255,.09);
    color:rgba(255,255,255,.65);
    font-size:12px;
    font-weight:700;
    cursor:pointer;
    transition:background .12s, color .12s;
    text-decoration:none;
  }

  .side-logout:hover{
    background:rgba(255,255,255,.10);
    color:#fff;
    text-decoration:none;
  }

  /* ── MAIN AREA ── */
  .main{
    flex:1;
    display:flex;
    flex-direction:column;
    min-width:0;
    min-height:100vh;
  }

  /* ── TOPBAR ── */
  .topbar{
    background:var(--card);
    border-bottom:1px solid var(--border);
    padding:0 22px;
    min-height:56px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:14px;
    position:sticky;
    top:0;
    z-index:10;
    box-shadow:0 1px 0 var(--border);
  }

  .topbar-left{
    display:flex;
    align-items:center;
    gap:12px;
    min-width:0;
  }

  .topbar-title{
    font-size:15px;
    font-weight:800;
    color:var(--text);
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }

  .topbar-sub{
    font-size:12px;
    color:var(--muted);
    margin-top:1px;
  }

  .topbar-right{
    display:flex;
    align-items:center;
    gap:10px;
    flex:0 0 auto;
  }

  /* ── CONTENT ── */
  .content{
    flex:1;
    padding:22px;
  }

  .container{
    width:min(1280px, 100%);
    margin:0 auto;
  }

  /* ── PAGE HEAD ── */
  .page-head{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:16px;
    margin-bottom:20px;
  }

  .page-head h1{
    margin:0;
    font-size:24px;
    font-weight:800;
    letter-spacing:-.4px;
    line-height:1.15;
    color:var(--text);
  }

  .page-head p{
    margin:5px 0 0;
    color:var(--muted);
    font-size:13.5px;
    line-height:1.5;
  }

  /* ── BUTTONS ── */
  .btn{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:6px;
    min-height:36px;
    padding:0 14px;
    border-radius:10px;
    border:1px solid var(--border);
    background:var(--card);
    font-weight:700;
    font-size:13px;
    cursor:pointer;
    text-decoration:none;
    white-space:nowrap;
    color:var(--text);
    transition:background .12s, border-color .12s, box-shadow .12s;
    line-height:1;
  }

  .btn:hover{
    background:#F8FAFC;
    border-color:#CBD5E1;
    text-decoration:none;
  }

  .btn-primary{
    background:linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
    color:#0F172A;
    border-color:transparent;
    font-weight:800;
  }

  .btn-primary:hover{
    filter:brightness(1.06);
    background:linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
    border-color:transparent;
  }

  .btn-navy{
    background:var(--navy);
    color:#fff;
    border-color:transparent;
  }

  .btn-navy:hover{
    filter:brightness(1.08);
    color:#fff;
    border-color:transparent;
  }

  .btn-danger{
    background:#FEF2F2;
    color:#991B1B;
    border-color:#FECACA;
  }

  .btn-danger:hover{
    background:#FEE2E2;
    border-color:#FCA5A5;
  }

  .btn-sm{
    min-height:30px;
    padding:0 10px;
    font-size:12px;
    border-radius:8px;
  }

  .btn-lg{
    min-height:42px;
    padding:0 20px;
    font-size:14px;
    border-radius:11px;
  }

  /* ── CARDS ── */
  .card{
    background:var(--card);
    border:1px solid var(--border);
    border-radius:var(--radius);
    box-shadow:var(--shadow);
    padding:16px 18px;
    min-width:0;
    overflow:hidden;
  }

  /* Navy gradient header strip — bleeds to card edges via negative margin */
  .card-head{
    background:linear-gradient(135deg, var(--navy-dark) 0%, var(--navy) 100%);
    padding:14px 18px;
    margin:-16px -18px 16px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    flex-wrap:wrap;
  }

  .card-head h2,
  .card-head h3{
    margin:0;
    color:#fff;
    font-size:15px;
    font-weight:800;
    letter-spacing:-.2px;
  }

  .card-head p{
    margin:3px 0 0;
    color:rgba(255,255,255,.60);
    font-size:12px;
  }

  .card-head-left{ min-width:0; }

  .card-head .btn{
    min-height:28px;
    padding:0 12px;
    font-size:12px;
    background:rgba(255,255,255,.12);
    border-color:rgba(255,255,255,.18);
    color:#fff;
    flex:0 0 auto;
  }

  .card-head .btn:hover{
    background:rgba(255,255,255,.20);
    border-color:rgba(255,255,255,.28);
  }

  .card-head .btn-primary{
    background:linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
    border-color:transparent;
    color:#0F172A;
    font-weight:800;
  }

  .card-head .btn-primary:hover{
    filter:brightness(1.06);
  }

  .card-section{
    padding:14px 18px;
    margin:0 -18px;
    border-bottom:1px solid var(--border);
  }

  .card-section:last-child{
    border-bottom:none;
    margin-bottom:-16px;
  }

  /* ── STAT GRID ── */
  .stat-grid{
    display:grid;
    gap:14px;
  }

  .stat-grid-4{ grid-template-columns:repeat(4, minmax(0,1fr)); }
  .stat-grid-3{ grid-template-columns:repeat(3, minmax(0,1fr)); }
  .stat-grid-2{ grid-template-columns:repeat(2, minmax(0,1fr)); }

  .stat-card{
    background:var(--card);
    border:1px solid var(--border);
    border-radius:var(--radius);
    box-shadow:var(--shadow);
    padding:16px 18px;
    display:flex;
    flex-direction:column;
    gap:4px;
    min-width:0;
  }

  .stat-label{
    font-size:11.5px;
    font-weight:700;
    color:var(--muted);
    text-transform:uppercase;
    letter-spacing:.05em;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }

  .stat-value{
    font-size:24px;
    font-weight:900;
    letter-spacing:-.03em;
    color:var(--text);
    line-height:1.1;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }

  .stat-sub{
    font-size:12px;
    color:var(--muted);
    margin-top:2px;
  }

  .stat-card-accent{
    border-top:3px solid var(--yellow);
  }

  .stat-card-navy{
    border-top:3px solid var(--navy);
  }

  .stat-card-green{
    border-top:3px solid #10B981;
  }

  .stat-card-red{
    border-top:3px solid #EF4444;
  }

  /* ── GRIDS ── */
  .grid{ display:grid; gap:14px; }
  .grid-2{ grid-template-columns:repeat(2, minmax(0,1fr)); }
  .grid-3{ grid-template-columns:repeat(3, minmax(0,1fr)); }
  .grid-4{ grid-template-columns:repeat(4, minmax(0,1fr)); }

  /* ── TABLES ── */
  .table-wrap{
    overflow:auto;
    -webkit-overflow-scrolling:touch;
  }

  table{
    width:100%;
    border-collapse:separate;
    border-spacing:0;
  }

  thead tr{
    background:#F8FAFC;
  }

  th{
    text-align:left;
    font-size:11px;
    font-weight:800;
    color:var(--muted);
    text-transform:uppercase;
    letter-spacing:.06em;
    padding:10px 14px;
    border-bottom:1px solid var(--border);
    white-space:nowrap;
  }

  td{
    padding:12px 14px;
    border-bottom:1px solid var(--border);
    vertical-align:middle;
    font-size:13.5px;
  }

  tbody tr{
    transition:background .1s;
  }

  tbody tr:hover{
    background:#F8FBFF;
  }

  tbody tr:last-child td{
    border-bottom:none;
  }

  .right{ text-align:right; }
  .center{ text-align:center; }

  /* ── FORMS ── */
  label{
    display:block;
    font-size:12px;
    font-weight:800;
    margin:14px 0 5px;
    color:#334155;
    letter-spacing:.01em;
  }

  input, select, textarea{
    width:100%;
    padding:10px 12px;
    border:1.5px solid var(--border);
    border-radius:10px;
    font-size:14px;
    outline:none;
    background:#FAFAFA;
    color:var(--text);
    transition:border-color .15s, box-shadow .15s, background .15s;
  }

  input:focus, select:focus, textarea:focus{
    border-color:rgba(30,58,95,.35);
    background:#fff;
    box-shadow:0 0 0 4px rgba(30,58,95,.09);
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

  /* ── BADGES ── */
  .badge{
    display:inline-flex;
    align-items:center;
    min-height:22px;
    padding:0 9px;
    border-radius:999px;
    border:1px solid var(--border);
    background:#F8FAFC;
    font-size:11px;
    font-weight:800;
    color:#475569;
    white-space:nowrap;
    letter-spacing:.02em;
  }

  .badge-warn{
    background:#FFFBEB;
    border-color:#FDE68A;
    color:#92400E;
  }

  .badge-good{
    background:#ECFDF5;
    border-color:#A7F3D0;
    color:#065F46;
  }

  .badge-bad{
    background:#FEF2F2;
    border-color:#FCA5A5;
    color:#991B1B;
  }

  .badge-blue{
    background:#EFF6FF;
    border-color:#BFDBFE;
    color:#1D4ED8;
  }

  .badge-navy{
    background:var(--navy);
    border-color:transparent;
    color:#fff;
  }

  .badge-yellow{
    background:#FFFBEB;
    border-color:#FDE68A;
    color:#92400E;
  }

  .badge-lg{
    min-height:28px;
    padding:0 12px;
    font-size:12px;
    border-radius:999px;
  }

  /* ── ACTIONS ROW ── */
  .actions{
    display:flex;
    gap:8px;
    align-items:center;
    flex-wrap:wrap;
  }

  .actions-right{
    justify-content:flex-end;
  }

  /* ── MISC ── */
  .muted{ color:var(--muted); }
  .bold{ font-weight:800; }

  .list{
    display:grid;
    gap:8px;
  }

  .list-item{
    padding:12px 14px;
    border:1px solid var(--border);
    border-radius:12px;
    background:#fff;
  }

  .divider{
    height:1px;
    background:var(--border);
    margin:16px 0;
  }

  .empty-state{
    text-align:center;
    padding:48px 20px;
    color:var(--muted);
  }

  .empty-state-icon{
    font-size:36px;
    margin-bottom:12px;
    opacity:.5;
  }

  .empty-state h3{
    margin:0 0 6px;
    font-size:16px;
    color:var(--text);
    font-weight:700;
  }

  .empty-state p{
    margin:0 0 16px;
    font-size:13.5px;
    line-height:1.6;
  }

  /* ── BILLING BANNER ── */
  .billing-banner{
    margin-bottom:18px;
    border-radius:12px;
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
    margin-bottom:3px;
    font-weight:800;
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

  /* ── PERMISSION CHIPS ── */
  .permission-chip-list{
    display:flex;
    flex-wrap:wrap;
    gap:5px;
    margin-top:6px;
  }

  .permission-chip{
    display:inline-flex;
    align-items:center;
    min-height:20px;
    padding:0 8px;
    border-radius:999px;
    background:rgba(255,255,255,.08);
    border:1px solid rgba(255,255,255,.12);
    font-size:10px;
    font-weight:800;
    color:rgba(255,255,255,.85);
    letter-spacing:.03em;
  }

  /* ── FOOTER ── */
  .app-footer{
    border-top:1px solid var(--border);
    background:var(--card);
    padding:14px 22px;
  }

  .app-footer-inner{
    width:min(1280px, 100%);
    margin:0 auto;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    flex-wrap:wrap;
    color:var(--muted);
    font-size:12px;
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
  }

  /* ── MOBILE ── */
  @media (max-width:900px){
    :root{ --sidebar-width:220px; }
  }

  @media (max-width:760px){
    .layout{
      flex-direction:column;
    }

    .sidebar{
      width:100%;
      flex:0 0 auto;
      height:auto;
      position:relative;
      overflow:visible;
    }

    .sidebar-inner{
      padding:12px 10px;
    }

    .brand{
      margin-bottom:6px;
    }

    .brand-logo{
      height:36px;
      width:36px;
      flex-basis:36px;
    }

    .nav{
      flex-direction:row;
      overflow-x:auto;
      overflow-y:visible;
      padding-bottom:2px;
      scrollbar-width:none;
    }

    .nav::-webkit-scrollbar{ display:none; }

    .nav a{
      flex:0 0 auto;
      white-space:nowrap;
      padding:7px 10px;
    }

    .nav-icon{
      width:22px;
      height:22px;
      font-size:11px;
    }

    .spacer,
    .side-foot{
      display:none;
    }

    .topbar{
      position:relative;
      padding:12px 14px;
      min-height:auto;
      flex-wrap:wrap;
    }

    .content{
      padding:14px;
    }

    .page-head{
      flex-direction:column;
      gap:10px;
    }

    .page-head .actions{
      width:100%;
    }

    .page-head .actions .btn{
      flex:1;
    }

    .grid-2,
    .grid-3,
    .grid-4,
    .stat-grid-2,
    .stat-grid-3,
    .stat-grid-4{
      grid-template-columns:1fr;
    }

    .row{
      flex-direction:column;
      align-items:stretch;
    }

    .row > *{
      min-width:0;
      width:100%;
    }

    .actions{
      width:100%;
      align-items:stretch;
    }

    .actions > .btn,
    .actions > a.btn,
    .actions > form{
      flex:1;
    }

    .billing-banner{
      flex-direction:column;
    }

    .billing-banner .btn{
      width:100%;
    }

    .app-footer-inner{
      flex-direction:column;
      align-items:flex-start;
    }

    .stat-grid-4{
      grid-template-columns:repeat(2, minmax(0,1fr));
    }

    .stat-grid-3{
      grid-template-columns:repeat(2, minmax(0,1fr));
    }
  }

  @media (max-width:480px){
    .stat-grid-4,
    .stat-grid-3,
    .stat-grid-2{
      grid-template-columns:1fr;
    }
  }

  @media (min-width:761px) and (max-width:1024px){
    .grid-4{ grid-template-columns:repeat(2, minmax(0,1fr)); }
    .stat-grid-4{ grid-template-columns:repeat(2, minmax(0,1fr)); }
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
    {
      label: 'Dashboard',
      icon: '📊',
      href: '/',
      patterns: ['/', '/dashboard'],
      visible: hasPermission(permissions, 'financials.view'),
    },
    {
      label: 'Jobs',
      icon: '🏗️',
      href: '/jobs',
      patterns: ['/jobs', '/add_job', '/job/', '/edit_job/'],
      visible: hasPermission(permissions, 'jobs.view'),
    },
    {
      label: 'Estimates',
      icon: '📋',
      href: '/estimates',
      patterns: ['/estimates', '/estimate/'],
      visible: hasPermission(permissions, 'jobs.view'),
    },
    {
      label: 'Reports',
      icon: '📈',
      href: '/reports',
      patterns: ['/reports', '/profit', '/job_costs'],
      visible: hasPermission(permissions, 'reports.view'),
    },
    {
      label: 'Employees',
      icon: '👥',
      href: '/employees',
      patterns: ['/employees', '/add_employee', '/edit_employee/'],
      visible: hasPermission(permissions, 'employees.view'),
    },
    {
      label: 'Timesheets',
      icon: '⏱️',
      href: '/timesheet',
      patterns: ['/timesheet'],
      visible: hasPermission(permissions, 'time.view'),
    },
    {
      label: 'Blueprints',
      icon: '📐',
      href: '/job-blueprints',
      patterns: ['/job-blueprints'],
      visible: !!currentUser,
    },
    {
      label: 'Invoices',
      icon: '🧾',
      href: '/invoices',
      patterns: ['/invoices', '/add_invoice', '/invoice/'],
      visible: hasPermission(permissions, 'invoices.view'),
    },
    {
      label: 'Bills',
      icon: '💰',
      href: '/monthly-bills',
      patterns: ['/monthly-bills'],
      visible: hasPermission(permissions, 'financials.view'),
    },
    {
      label: 'Fleet',
      icon: '🚛',
      href: '/fleet',
      patterns: ['/fleet', '/fleet/vehicles/'],
      visible: hasPermission(permissions, 'fleet.view'),
    },
    {
      label: 'Activity',
      icon: '📝',
      href: '/activity',
      patterns: ['/activity'],
      visible: hasPermission(permissions, 'activity.view'),
    },
    {
      label: 'Users',
      icon: '👤',
      href: '/users',
      patterns: ['/users', '/add_user', '/edit_user/'],
      visible: hasPermission(permissions, 'users.view'),
    },
    {
      label: 'Billing',
      icon: '💳',
      href: '/billing',
      patterns: ['/billing'],
      visible: hasPermission(permissions, 'billing.view'),
    },
    {
      label: 'Settings',
      icon: '⚙️',
      href: '/settings',
      patterns: ['/settings'],
      visible: hasPermission(permissions, 'settings.view'),
    },
    {
      label: 'My Account',
      icon: '🔑',
      href: '/my-account',
      patterns: ['/my-account'],
      visible: !!currentUser,
    },
    {
      label: 'Support',
      icon: '💬',
      href: '/support',
      patterns: ['/support'],
      visible: !!currentUser,
    },
  ].filter((item) => item.visible);
}

function resolveLayoutBillingState(tenant: AppLayoutProps['currentTenant']): string {
  if (!tenant) return 'unknown';

  return resolveEffectiveBillingState({
    billing_exempt: Number(tenant.billing_exempt || 0),
    billing_status: String(tenant.billing_status || 'trialing'),
    billing_trial_ends_at: tenant.billing_trial_ends_at || null,
    billing_grace_ends_at: tenant.billing_grace_ends_at || null,
    billing_state: tenant.billing_state || null,
    billing_grace_until: tenant.billing_grace_until || null,
  });
}

function billingBadgeClass(tenant: AppLayoutProps['currentTenant']): string {
  const state = resolveLayoutBillingState(tenant);
  if (state === 'exempt' || state === 'internal' || state === 'active') return 'badge badge-good';
  if (state === 'trialing' || state === 'past_due' || state === 'grace_period') return 'badge badge-warn';
  if (state === 'suspended' || state === 'canceled') return 'badge badge-bad';
  return 'badge';
}

function billingBadgeLabel(tenant: AppLayoutProps['currentTenant']): string {
  const state = resolveLayoutBillingState(tenant);
  if (state === 'unknown') return 'No Tenant';

  return String(state)
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

  if (hasPermission(permissions, 'settings.manage')) chips.push('Settings');
  if (hasPermission(permissions, 'users.edit')) chips.push('User Mgmt');
  if (hasPermission(permissions, 'financials.edit')) chips.push('Financials');
  if (hasPermission(permissions, 'time.approve')) chips.push('Approvals');
  if (hasPermission(permissions, 'billing.manage')) chips.push('Billing');

  if (chips.length === 0 && hasPermission(permissions, 'time.clock')) {
    chips.push('Time Clock');
  }

  return chips.slice(0, 3);
}

function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
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
  const userInitials = currentUser ? getUserInitials(currentUser.name) : '?';

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

          {/* ── SIDEBAR ── */}
          <aside class="sidebar">
            <div class="sidebar-inner">

              <a class="brand" href="/">
                <img class="brand-logo" src={appLogo} alt="Logo" />
                <div class="brand-text">
                  <strong>{displayAppName}</strong>
                  <span>{currentTenant ? currentTenant.name : 'Workspace'}</span>
                </div>
              </a>

              <nav class="nav">
                {navItems.map((item) => (
                  <a
                    href={item.href}
                    class={isActive(path, item.patterns) ? 'active' : undefined}
                  >
                    <span class="nav-icon">{item.icon}</span>
                    {item.label}
                  </a>
                ))}
              </nav>

              <div class="spacer" />

              <div class="side-foot">
                {currentUser ? (
                  <div class="side-user">
                    <div class="side-avatar">{userInitials}</div>
                    <div class="side-user-info">
                      <div class="side-user-name">{currentUser.name}</div>
                      <div class="side-user-role">{describeRole(currentUser.role)}</div>
                    </div>
                  </div>
                ) : null}

                {permissionSummary.length ? (
                  <div class="permission-chip-list">
                    {permissionSummary.map((item) => (
                      <span class="permission-chip">{item}</span>
                    ))}
                  </div>
                ) : null}

                <div class="side-billing">
                  <span class="side-tenant-label">
                    {currentSubdomain ? currentSubdomain : 'workspace'}
                  </span>
                  <span class={billingBadgeClass(currentTenant)}>
                    {billingBadgeLabel(currentTenant)}
                  </span>
                </div>

                <a class="side-logout" href="/logout">
                  Sign out
                </a>
              </div>

            </div>
          </aside>

          {/* ── MAIN ── */}
          <main class="main">

            <header class="topbar">
              <div class="topbar-left">
                <div>
                  <div class="topbar-title">
                    {currentTenant ? currentTenant.name : displayAppName}
                  </div>
                  {subtitle ? (
                    <div class="topbar-sub">{subtitle}</div>
                  ) : null}
                </div>
              </div>

              <div class="topbar-right">
                {currentUser ? (
                  <span class="badge">
                    {currentUser.name}
                  </span>
                ) : null}
              </div>
            </header>

            <div class="content">
              <div class="container">

                {currentTenant?.subdomain === 'demo' ? (
                  <div class="billing-banner billing-banner-warn" style="align-items:center;">
                    <div>
                      <strong>You're exploring a demo workspace</strong>
                      <p>This is a pre-loaded sample account. Sign up free to create your own workspace with your real data.</p>
                    </div>
                    <a class="btn btn-navy" href="/" style="white-space:nowrap;">Get Started Free</a>
                  </div>
                ) : null}

                {billingBanner && path !== '/billing' ? (
                  <div class={billingBannerClass(billingBanner.tone)}>
                    <div>
                      <strong>{billingBanner.title}</strong>
                      <p>{billingBanner.message}</p>
                    </div>
                    <a class="btn btn-navy" href="/billing">Manage Billing</a>
                  </div>
                ) : null}

                {children}

              </div>
            </div>

            <footer class="app-footer">
              <div class="app-footer-inner">
                <div>© {year} {displayAppName}</div>
                <div class="app-footer-links">
                  <a href="/terms">Terms</a>
                  <a href="/privacy">Privacy</a>
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
