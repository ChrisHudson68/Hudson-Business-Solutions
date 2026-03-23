import type { FC } from 'hono/jsx';

interface ContactPageProps {
  appName: string;
}

export const ContactPage: FC<ContactPageProps> = ({ appName }) => {
  return (
    <div>
      <style>{`
        .contact-shell{
          display:flex;
          flex-direction:column;
          gap:18px;
        }

        .contact-hero{
          display:grid;
          grid-template-columns:minmax(0, 1.05fr) minmax(320px, 0.95fr);
          gap:24px;
          align-items:start;
        }

        .contact-hero-card,
        .contact-side-card,
        .contact-section{
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:22px;
          box-shadow:0 14px 34px rgba(15,23,42,0.06);
          padding:24px;
        }

        .contact-eyebrow{
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

        .contact-title{
          margin:0 0 10px;
          font-size:42px;
          line-height:1.04;
          letter-spacing:-0.03em;
          color:#0F172A;
          font-weight:900;
        }

        .contact-copy{
          margin:0;
          color:#64748B;
          line-height:1.8;
          font-size:16px;
          max-width:760px;
        }

        .contact-stat-grid{
          display:grid;
          grid-template-columns:repeat(3, minmax(0,1fr));
          gap:14px;
          margin-top:18px;
        }

        .contact-stat{
          border:1px solid #E5EAF2;
          border-radius:18px;
          background:#F8FAFC;
          padding:18px;
        }

        .contact-stat-label{
          color:#64748B;
          font-size:12px;
          font-weight:800;
          text-transform:uppercase;
          letter-spacing:.06em;
        }

        .contact-stat-value{
          margin-top:8px;
          font-size:24px;
          font-weight:900;
          letter-spacing:-0.03em;
          color:#0F172A;
        }

        .contact-stat-copy{
          margin-top:6px;
          color:#64748B;
          line-height:1.7;
          font-size:13px;
        }

        .contact-side-title,
        .contact-section-title{
          margin:0 0 8px;
          font-size:24px;
          line-height:1.1;
          letter-spacing:-0.03em;
          color:#0F172A;
          font-weight:900;
        }

        .contact-side-copy,
        .contact-section-copy{
          margin:0 0 16px;
          color:#64748B;
          line-height:1.8;
        }

        .contact-list{
          display:grid;
          gap:10px;
        }

        .contact-list-item{
          padding:14px 16px;
          border-radius:16px;
          background:#F8FAFC;
          border:1px solid #E5EAF2;
          color:#475569;
          line-height:1.7;
        }

        .contact-list-item strong{
          color:#0F172A;
        }

        .contact-grid{
          display:grid;
          grid-template-columns:repeat(3, minmax(0,1fr));
          gap:16px;
        }

        .contact-card{
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:20px;
          box-shadow:0 10px 24px rgba(15,23,42,0.05);
          padding:20px;
        }

        .contact-card-title{
          margin:0 0 8px;
          font-size:18px;
          font-weight:900;
          color:#0F172A;
        }

        .contact-card-copy{
          color:#64748B;
          line-height:1.75;
          margin-bottom:14px;
        }

        .contact-card-link{
          font-weight:800;
          word-break:break-word;
        }

        .contact-help-grid{
          display:grid;
          grid-template-columns:repeat(2, minmax(0,1fr));
          gap:16px;
        }

        .contact-help-card{
          padding:18px;
          border-radius:18px;
          border:1px solid #E5EAF2;
          background:#F8FAFC;
        }

        .contact-help-title{
          font-weight:900;
          color:#0F172A;
          margin-bottom:8px;
          font-size:17px;
        }

        .contact-help-copy{
          color:#64748B;
          line-height:1.75;
        }

        .contact-bottom{
          text-align:center;
          padding:8px 0 0;
        }

        .contact-bottom-title{
          margin:0 0 10px;
          font-size:30px;
          line-height:1.12;
          font-weight:900;
          letter-spacing:-0.03em;
          color:#0F172A;
        }

        .contact-bottom-copy{
          max-width:760px;
          margin:0 auto 18px;
          color:#64748B;
          line-height:1.8;
          font-size:16px;
        }

        .contact-actions{
          display:flex;
          justify-content:center;
          gap:12px;
          flex-wrap:wrap;
        }

        @media (max-width: 980px){
          .contact-hero,
          .contact-grid,
          .contact-help-grid{
            grid-template-columns:1fr;
          }

          .contact-stat-grid{
            grid-template-columns:1fr;
          }
        }

        @media (max-width: 640px){
          .contact-hero-card,
          .contact-side-card,
          .contact-section{
            padding:18px;
          }

          .contact-title{
            font-size:33px;
          }

          .contact-side-title,
          .contact-section-title{
            font-size:22px;
          }

          .contact-bottom-title{
            font-size:25px;
          }

          .contact-actions{
            flex-direction:column;
            align-items:stretch;
          }

          .contact-actions .btn{
            width:100%;
          }
        }
      `}</style>

      <div class="contact-shell">
        <section class="contact-hero">
          <div class="contact-hero-card">
            <div class="contact-eyebrow">Contact Hudson Business Solutions</div>
            <h1 class="contact-title">Talk to us about setup, billing, or using the platform.</h1>
            <p class="contact-copy">
              Whether you are exploring {appName}, getting ready to create a workspace,
              or need help with an existing company account, this page gives you the
              clearest path to the right next step.
            </p>

            <div class="contact-stat-grid">
              <div class="contact-stat">
                <div class="contact-stat-label">New Companies</div>
                <div class="contact-stat-value">Start Here</div>
                <div class="contact-stat-copy">
                  Reach out if you want help understanding whether the platform is a fit for your business.
                </div>
              </div>

              <div class="contact-stat">
                <div class="contact-stat-label">Existing Customers</div>
                <div class="contact-stat-value">In-App Support</div>
                <div class="contact-stat-copy">
                  Current workspace users should use the Support Center inside the platform for the fastest workflow.
                </div>
              </div>

              <div class="contact-stat">
                <div class="contact-stat-label">Billing Questions</div>
                <div class="contact-stat-value">Clear Path</div>
                <div class="contact-stat-copy">
                  Subscription and account questions can be handled through billing tools and support workflows.
                </div>
              </div>
            </div>
          </div>

          <div class="contact-side-card">
            <h2 class="contact-side-title">Best way to get help</h2>
            <p class="contact-side-copy">
              The right contact path depends on whether you are evaluating the platform or already using it.
            </p>

            <div class="contact-list">
              <div class="contact-list-item">
                <strong>Not a customer yet?</strong><br />
                Use the public contact information below if you want to ask about the platform before creating a workspace.
              </div>

              <div class="contact-list-item">
                <strong>Already have a workspace?</strong><br />
                Sign in and use the in-app Support Center so your request is tied to the correct company account.
              </div>

              <div class="contact-list-item">
                <strong>Need billing help?</strong><br />
                Existing customers should review the Billing page first, then open a support request if additional help is needed.
              </div>
            </div>
          </div>
        </section>

        <section class="contact-section">
          <h2 class="contact-section-title">Public contact options</h2>
          <p class="contact-section-copy">
            Use these options when you need to reach Hudson Business Solutions outside the product.
          </p>

          <div class="contact-grid">
            <div class="contact-card">
              <h3 class="contact-card-title">Email</h3>
              <div class="contact-card-copy">
                Best for general questions, early conversations, and non-urgent contact.
              </div>
              <a class="contact-card-link" href="mailto:Christopher.Hudson@hudson-business-solutions.com">
                Christopher.Hudson@hudson-business-solutions.com
              </a>
            </div>

            <div class="contact-card">
              <h3 class="contact-card-title">Phone</h3>
              <div class="contact-card-copy">
                Best for direct business contact when a call is the clearest way to discuss your needs.
              </div>
              <a class="contact-card-link" href="tel:+12522143379">
                (252) 214-3379
              </a>
            </div>

            <div class="contact-card">
              <h3 class="contact-card-title">Website</h3>
              <div class="contact-card-copy">
                Start here if you want to review the platform, pricing, and public information first.
              </div>
              <a class="contact-card-link" href="/">
                hudson-business-solutions.com
              </a>
            </div>
          </div>
        </section>

        <section class="contact-section">
          <h2 class="contact-section-title">When to use in-app support instead</h2>
          <p class="contact-section-copy">
            Existing customers will usually get the best experience by staying inside the platform.
          </p>

          <div class="contact-help-grid">
            <div class="contact-help-card">
              <div class="contact-help-title">Use the Support Center for</div>
              <div class="contact-help-copy">
                Technical issues, workflow questions, account access problems, invoice issues, job questions,
                and anything that should be tied directly to your company workspace.
              </div>
            </div>

            <div class="contact-help-card">
              <div class="contact-help-title">Use the Billing page for</div>
              <div class="contact-help-copy">
                Reviewing subscription status, understanding billing state, updating payment details,
                and opening billing-related follow-up requests when needed.
              </div>
            </div>
          </div>
        </section>

        <section class="contact-section contact-bottom">
          <h2 class="contact-bottom-title">Ready to get started?</h2>
          <p class="contact-bottom-copy">
            Create your company workspace, explore the platform, or reach out directly if you want help deciding
            whether Hudson Business Solutions is the right fit for your construction business.
          </p>

          <div class="contact-actions">
            <a class="btn btn-primary" href="/signup">Create Workspace</a>
            <a class="btn" href="/pick-tenant">Find My Workspace</a>
            <a class="btn" href="/">Back to Home</a>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ContactPage;