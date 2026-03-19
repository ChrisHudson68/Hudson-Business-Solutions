import type { FC } from 'hono/jsx';

interface PrivacyPageProps {
  appName: string;
}

export const PrivacyPage: FC<PrivacyPageProps> = ({ appName }) => {
  return (
    <div>
      <style>{`
        .legal-shell{
          display:flex;
          flex-direction:column;
          gap:18px;
        }

        .legal-hero,
        .legal-section,
        .legal-side-card{
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:22px;
          box-shadow:0 14px 34px rgba(15,23,42,0.06);
          padding:24px;
        }

        .legal-hero-grid{
          display:grid;
          grid-template-columns:minmax(0, 1.05fr) minmax(320px, 0.95fr);
          gap:24px;
          align-items:start;
        }

        .legal-eyebrow{
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

        .legal-title{
          margin:0 0 10px;
          font-size:42px;
          line-height:1.04;
          letter-spacing:-0.03em;
          color:#0F172A;
          font-weight:900;
        }

        .legal-copy{
          margin:0;
          color:#64748B;
          line-height:1.8;
          font-size:16px;
          max-width:760px;
        }

        .legal-meta{
          display:grid;
          gap:10px;
        }

        .legal-meta-item{
          padding:14px 16px;
          border-radius:16px;
          background:#F8FAFC;
          border:1px solid #E5EAF2;
          color:#475569;
          line-height:1.7;
        }

        .legal-meta-item strong{
          color:#0F172A;
        }

        .legal-section-title{
          margin:0 0 10px;
          font-size:24px;
          line-height:1.1;
          letter-spacing:-0.03em;
          color:#0F172A;
          font-weight:900;
        }

        .legal-section-copy{
          color:#64748B;
          line-height:1.85;
        }

        .legal-section-copy p{
          margin:0 0 14px;
        }

        .legal-section-copy p:last-child{
          margin-bottom:0;
        }

        .legal-grid{
          display:grid;
          grid-template-columns:repeat(2, minmax(0,1fr));
          gap:16px;
        }

        .legal-highlight{
          padding:18px;
          border-radius:18px;
          border:1px solid #E5EAF2;
          background:#F8FAFC;
        }

        .legal-highlight-title{
          font-weight:900;
          color:#0F172A;
          margin-bottom:8px;
          font-size:17px;
        }

        .legal-highlight-copy{
          color:#64748B;
          line-height:1.75;
        }

        .legal-bottom{
          text-align:center;
          padding:8px 0 0;
        }

        .legal-bottom-title{
          margin:0 0 10px;
          font-size:30px;
          line-height:1.12;
          font-weight:900;
          letter-spacing:-0.03em;
          color:#0F172A;
        }

        .legal-bottom-copy{
          max-width:760px;
          margin:0 auto 18px;
          color:#64748B;
          line-height:1.8;
          font-size:16px;
        }

        .legal-actions{
          display:flex;
          justify-content:center;
          gap:12px;
          flex-wrap:wrap;
        }

        @media (max-width: 980px){
          .legal-hero-grid,
          .legal-grid{
            grid-template-columns:1fr;
          }
        }

        @media (max-width: 640px){
          .legal-hero,
          .legal-section,
          .legal-side-card{
            padding:18px;
          }

          .legal-title{
            font-size:33px;
          }

          .legal-section-title{
            font-size:22px;
          }

          .legal-bottom-title{
            font-size:25px;
          }

          .legal-actions{
            flex-direction:column;
            align-items:stretch;
          }

          .legal-actions .btn{
            width:100%;
          }
        }
      `}</style>

      <div class="legal-shell">
        <section class="legal-hero legal-hero-grid">
          <div>
            <div class="legal-eyebrow">Privacy Policy</div>
            <h1 class="legal-title">How {appName} handles platform and account information.</h1>
            <p class="legal-copy">
              This Privacy Policy explains, at a high level, how Hudson Business Solutions
              handles information related to public visitors, company workspaces, users,
              billing activity, and support-related communication.
            </p>
          </div>

          <div class="legal-side-card">
            <div class="legal-meta">
              <div class="legal-meta-item">
                <strong>Purpose:</strong> Explain what information is used to operate the platform and support customers.
              </div>
              <div class="legal-meta-item">
                <strong>Focus:</strong> Business account, workspace, support, and operational information.
              </div>
              <div class="legal-meta-item">
                <strong>Questions:</strong> Use the Contact page if you need clarification about privacy-related concerns.
              </div>
            </div>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">1. Information the platform may handle</h2>
          <div class="legal-section-copy">
            <p>
              Hudson Business Solutions may handle information needed to create and operate company workspaces,
              including company details, user account details, workspace settings, billing-related status,
              support tickets, operational records, and business workflow data entered by authorized users.
            </p>
            <p>
              Depending on how a company uses the platform, this may include records related to jobs, employees,
              time entries, invoices, payments, expenses, income, reports, and internal platform activity tied
              to the workspace.
            </p>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">2. Why information is used</h2>
          <div class="legal-section-copy">
            <p>
              Information is used to provide and improve the platform, maintain workspace access, support billing,
              deliver support services, help users navigate product workflows, protect platform security, and maintain
              service reliability.
            </p>
            <p>
              Information may also be used for operational visibility, audit history, account administration,
              troubleshooting, and ongoing product improvement.
            </p>
          </div>
        </section>

        <section class="legal-grid">
          <div class="legal-highlight">
            <div class="legal-highlight-title">Operational use</div>
            <div class="legal-highlight-copy">
              Data is used to help workspaces operate inside the product, including access control, billing visibility,
              reporting, support workflows, and security-related review.
            </div>
          </div>

          <div class="legal-highlight">
            <div class="legal-highlight-title">Service improvement</div>
            <div class="legal-highlight-copy">
              Information may also be reviewed in a limited operational context to improve workflows, fix issues,
              and make the platform more dependable for customers.
            </div>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">3. Workspace and account access</h2>
          <div class="legal-section-copy">
            <p>
              Each company workspace is intended to operate separately with its own users, settings, and records.
              Access to workspace data is generally limited to authorized users for that company and platform-level
              administrative access required to operate, maintain, secure, or support the service.
            </p>
            <p>
              Customer support and platform administration tools may allow limited administrative access when needed
              for troubleshooting, billing review, security response, or support assistance.
            </p>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">4. Billing and payment-related information</h2>
          <div class="legal-section-copy">
            <p>
              Subscription handling may involve billing status, subscription state, customer identifiers, and related
              payment-management workflows. Payment processing itself may be handled through connected third-party billing
              providers rather than stored directly as full payment-card details inside the application.
            </p>
            <p>
              Billing information is used to maintain subscriptions, communicate billing state, support payment recovery,
              and help customers manage their company account status.
            </p>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">5. Support, logging, and security-related information</h2>
          <div class="legal-section-copy">
            <p>
              The platform may maintain support tickets, activity history, and related operational logs to help investigate
              issues, respond to requests, improve accountability, and protect the service.
            </p>
            <p>
              This may include records of user actions, workspace activity, support interactions, account events,
              and similar operational information reasonably related to running the platform.
            </p>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">6. Information sharing</h2>
          <div class="legal-section-copy">
            <p>
              Hudson Business Solutions does not provide company workspace information to unrelated outside parties
              except where reasonably necessary to operate the service, comply with legal obligations, protect the platform,
              respond to security concerns, or work with trusted service providers involved in platform infrastructure,
              billing, hosting, or support operations.
            </p>
            <p>
              Any such sharing is expected to be limited to legitimate operational or legal needs.
            </p>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">7. Data retention and platform changes</h2>
          <div class="legal-section-copy">
            <p>
              Information may be retained for as long as reasonably needed to operate the service, support customer accounts,
              maintain business records, investigate issues, preserve audit or billing history, and comply with operational
              or legal requirements.
            </p>
            <p>
              As the platform evolves, this Privacy Policy may be updated to reflect changes in features, workflows,
              billing handling, support processes, infrastructure, or legal requirements.
            </p>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">8. Your role in protecting workspace information</h2>
          <div class="legal-section-copy">
            <p>
              Company administrators and users should help protect workspace information by using appropriate credentials,
              limiting access to authorized users, and keeping account and workspace information accurate.
            </p>
            <p>
              Customers remain responsible for the data they enter into their workspace and for their own internal handling
              of business records, employee information, financial records, and related company processes.
            </p>
          </div>
        </section>

        <section class="legal-section legal-bottom">
          <h2 class="legal-bottom-title">Want to review the rest of the public trust flow?</h2>
          <p class="legal-bottom-copy">
            You can return to the site, review the Terms of Service, or contact Hudson Business Solutions directly
            for more information.
          </p>

          <div class="legal-actions">
            <a class="btn btn-primary" href="/terms">Terms of Service</a>
            <a class="btn" href="/contact">Contact Us</a>
            <a class="btn" href="/">Back to Home</a>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPage;