import type { FC } from 'hono/jsx';

interface ContactPageProps {
  appName: string;
}

export const ContactPage: FC<ContactPageProps> = ({ appName }) => {
  return (
    <div style="max-width:920px; margin:0 auto;">
      <div class="card" style="padding:32px;">
        <div class="page-head" style="text-align:left; margin-bottom:24px;">
          <h1>Contact Us</h1>
          <p>Questions, support requests, billing issues, or general inquiries.</p>
        </div>

        <div style="display:grid; gap:18px; color:#334155; line-height:1.75; font-size:14px;">
          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">Hudson Business Solutions</h2>
            <p style="margin:0;">
              {appName} is construction business software built to help contractors manage jobs,
              finances, employees, timesheets, invoicing, and billing workflows in one place.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">Support</h2>
            <p style="margin:0;">
              For account assistance, product questions, billing concerns, or technical issues, contact:
            </p>
            <p style="margin:10px 0 0;">
              <a href="mailto:christopher.hudson.work@gmail.com">
                christopher.hudson.work@gmail.com
              </a>
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">Response Expectations</h2>
            <p style="margin:0;">
              We aim to respond as promptly as possible. Response times may vary based on request
              volume, severity, and whether the issue affects billing, access, or critical business workflows.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">Existing Customers</h2>
            <p style="margin:0;">
              If you already have an account, the fastest way to report a platform issue is through the
              in-app support page within your workspace. That helps us triage the request with your tenant
              and account context.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">Sales and General Inquiries</h2>
            <p style="margin:0;">
              For partnership, onboarding, pricing, or general product questions, please use the same
              contact email above and include a short summary of your company and what you are looking for.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;