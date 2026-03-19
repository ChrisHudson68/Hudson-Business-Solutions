import type { FC } from 'hono/jsx';

interface TermsPageProps {
  appName: string;
}

export const TermsPage: FC<TermsPageProps> = ({ appName }) => {
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
            <div class="legal-eyebrow">Terms of Service</div>
            <h1 class="legal-title">Clear terms for using {appName}.</h1>
            <p class="legal-copy">
              These terms describe the general rules, responsibilities, and expectations
              that apply when you access or use Hudson Business Solutions. They are written
              to keep the platform relationship straightforward and professional.
            </p>
          </div>

          <div class="legal-side-card">
            <div class="legal-meta">
              <div class="legal-meta-item">
                <strong>Scope:</strong> These terms apply to public visitors, trial users, and subscribed company workspaces.
              </div>
              <div class="legal-meta-item">
                <strong>Platform use:</strong> Access to the service is tied to valid company workspaces and authorized users.
              </div>
              <div class="legal-meta-item">
                <strong>Questions:</strong> If you need clarification, use the contact options on the Contact page.
              </div>
            </div>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">1. Use of the platform</h2>
          <div class="legal-section-copy">
            <p>
              Hudson Business Solutions provides software tools for construction business operations,
              including workflows related to job costing, labor tracking, invoicing, payments, reporting,
              billing, and related administrative tasks.
            </p>
            <p>
              You agree to use the platform only for lawful business purposes and only in connection
              with your company’s authorized workspace. You are responsible for ensuring that the
              information entered into your workspace is accurate and that your users access the service
              appropriately.
            </p>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">2. Accounts and workspace responsibility</h2>
          <div class="legal-section-copy">
            <p>
              Each company workspace is responsible for its own users, account access, internal permissions,
              and workspace activity. Company administrators are responsible for deciding who should have access
              and for keeping that access current.
            </p>
            <p>
              You are responsible for maintaining the confidentiality of your login credentials and for all
              activity that occurs through your company workspace, except where access issues are directly caused
              by the platform itself.
            </p>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">3. Billing and subscription access</h2>
          <div class="legal-section-copy">
            <p>
              Access to paid areas of the platform may depend on an active subscription, applicable trial status,
              or approved billing exception. If billing becomes overdue, access or features may be limited based on
              the billing status associated with the workspace.
            </p>
            <p>
              Subscription terms, billing status, and payment-management workflows are handled through the platform’s
              billing tools and connected payment systems. You are responsible for maintaining accurate billing information
              for your company workspace.
            </p>
          </div>
        </section>

        <section class="legal-grid">
          <div class="legal-highlight">
            <div class="legal-highlight-title">What users should expect</div>
            <div class="legal-highlight-copy">
              A professional, business-focused platform intended to help construction companies operate with cleaner
              workflows and better visibility.
            </div>
          </div>

          <div class="legal-highlight">
            <div class="legal-highlight-title">What workspaces are responsible for</div>
            <div class="legal-highlight-copy">
              Their own users, entered data, billing status, internal processes, and the decisions they make using
              the platform.
            </div>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">4. Acceptable use</h2>
          <div class="legal-section-copy">
            <p>
              You may not use the service to interfere with platform operation, attempt unauthorized access,
              misuse other company workspaces, submit harmful content, or use the platform in a way that violates
              applicable law.
            </p>
            <p>
              Access may be suspended or terminated if platform use creates security concerns, violates these terms,
              or materially disrupts the service for other users or workspaces.
            </p>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">5. Data and platform availability</h2>
          <div class="legal-section-copy">
            <p>
              Hudson Business Solutions is intended to operate as a dependable software platform, but no online service
              can promise uninterrupted availability at all times. Maintenance, updates, third-party service issues,
              or unexpected technical problems may occasionally affect access.
            </p>
            <p>
              The platform may continue to evolve over time through bug fixes, workflow improvements, operational tools,
              interface refinements, and new features intended to improve service quality and customer experience.
            </p>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">6. Support and operational communication</h2>
          <div class="legal-section-copy">
            <p>
              Existing customers should generally use in-app support tools for platform issues, workflow questions,
              or billing-related follow-up. Public contact methods may also be used for general business communication.
            </p>
            <p>
              Platform communications may include account, billing, support, operational, or service-related notices
              that are reasonably necessary to operate the service.
            </p>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">7. Limitation of responsibility</h2>
          <div class="legal-section-copy">
            <p>
              The platform is provided as a business software service intended to improve company operations, but your
              company remains responsible for its own financial records, business decisions, job management, invoicing,
              payroll-related handling, compliance obligations, and related outcomes.
            </p>
            <p>
              To the fullest extent allowed by applicable law, Hudson Business Solutions is not responsible for indirect,
              incidental, or consequential losses arising from platform use, service interruption, user error, inaccurate
              workspace data, or customer-side operational decisions.
            </p>
          </div>
        </section>

        <section class="legal-section">
          <h2 class="legal-section-title">8. Changes to these terms</h2>
          <div class="legal-section-copy">
            <p>
              These terms may be updated as the platform evolves. Updated terms may reflect product improvements,
              billing-process refinements, support-process changes, legal updates, or operational clarifications.
            </p>
            <p>
              Continued use of the platform after updated terms are posted will generally mean you accept the revised terms.
            </p>
          </div>
        </section>

        <section class="legal-section legal-bottom">
          <h2 class="legal-bottom-title">Need more context before getting started?</h2>
          <p class="legal-bottom-copy">
            Review the Privacy Policy, contact Hudson Business Solutions directly, or return to the main site
            to continue exploring the platform.
          </p>

          <div class="legal-actions">
            <a class="btn btn-primary" href="/privacy">Privacy Policy</a>
            <a class="btn" href="/contact">Contact Us</a>
            <a class="btn" href="/">Back to Home</a>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TermsPage;