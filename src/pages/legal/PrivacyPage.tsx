import type { FC } from 'hono/jsx';

interface PrivacyPageProps {
  appName: string;
}

export const PrivacyPage: FC<PrivacyPageProps> = ({ appName }) => {
  return (
    <div style="max-width:920px; margin:0 auto;">
      <div class="card" style="padding:32px;">
        <div class="page-head" style="text-align:left; margin-bottom:24px;">
          <h1>Privacy Policy</h1>
          <p>Last Updated: March 12, 2026</p>
        </div>

        <div style="display:grid; gap:18px; color:#334155; line-height:1.75; font-size:14px;">
          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">1. Overview</h2>
            <p style="margin:0;">
              {appName} respects your privacy. This Privacy Policy explains what information we collect,
              how we use it, and the choices available to you when you use our software and related services.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">2. Information We Collect</h2>
            <p style="margin:0;">
              We may collect information you provide directly, including:
            </p>
            <ul style="margin:10px 0 0 20px; padding:0;">
              <li>name and contact information</li>
              <li>email address and login credentials</li>
              <li>company and tenant information</li>
              <li>job, project, invoice, payment, and timesheet data</li>
              <li>uploaded receipts, logos, and related files</li>
              <li>support requests and communications</li>
            </ul>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">3. Information Collected Automatically</h2>
            <p style="margin:0;">
              We may automatically collect limited technical information such as IP address, browser type,
              device information, request logs, authentication events, and general usage activity needed to
              operate, secure, and improve the Service.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">4. How We Use Information</h2>
            <p style="margin:0;">
              We use information to:
            </p>
            <ul style="margin:10px 0 0 20px; padding:0;">
              <li>provide and maintain the Service</li>
              <li>authenticate users and secure accounts</li>
              <li>process customer data inside workspaces</li>
              <li>respond to support requests</li>
              <li>improve platform performance, reliability, and usability</li>
              <li>communicate about service updates, security issues, and billing matters</li>
              <li>comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">5. Legal Basis and Consent</h2>
            <p style="margin:0;">
              By using the Service and submitting information, you consent to the collection and use of your
              information as described in this Privacy Policy, to the extent consent is required by applicable law.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">6. Data Sharing</h2>
            <p style="margin:0;">
              We do not sell your personal information. We may share information only with service providers
              or infrastructure partners that help us host, secure, support, or operate the Service, or where
              required by law.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">7. Data Retention</h2>
            <p style="margin:0;">
              We retain information for as long as reasonably necessary to provide the Service, meet legal or
              operational requirements, resolve disputes, enforce agreements, and maintain backups.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">8. Data Security</h2>
            <p style="margin:0;">
              We use reasonable administrative, technical, and organizational safeguards to protect information.
              However, no system is completely secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">9. Cookies and Session Data</h2>
            <p style="margin:0;">
              We use cookies or similar technologies that are necessary for authentication, session management,
              security, and core application functionality.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">10. Your Rights</h2>
            <p style="margin:0;">
              Depending on your location, you may have rights to request access to, correction of, or deletion
              of certain personal information. To make a request, contact us using the information below.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">11. Children’s Privacy</h2>
            <p style="margin:0;">
              The Service is not intended for children under 13, and we do not knowingly collect personal
              information from children.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">12. Changes to This Policy</h2>
            <p style="margin:0;">
              We may update this Privacy Policy from time to time. Continued use of the Service after changes
              become effective constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">13. Contact</h2>
            <p style="margin:0;">
              Questions or requests related to this Privacy Policy may be sent to:
            </p>
            <p style="margin:10px 0 0;">
              support@hudson-business-solutions.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;