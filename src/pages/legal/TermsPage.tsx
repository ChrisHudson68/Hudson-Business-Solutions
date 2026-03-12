import type { FC } from 'hono/jsx';

interface TermsPageProps {
  appName: string;
}

export const TermsPage: FC<TermsPageProps> = ({ appName }) => {
  return (
    <div style="max-width:920px; margin:0 auto;">
      <div class="card" style="padding:32px;">
        <div class="page-head" style="text-align:left; margin-bottom:24px;">
          <h1>Terms of Service</h1>
          <p>Last Updated: March 12, 2026</p>
        </div>

        <div style="display:grid; gap:18px; color:#334155; line-height:1.75; font-size:14px;">
          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">1. Acceptance of Terms</h2>
            <p style="margin:0;">
              By accessing or using {appName} (“Service”), you agree to be bound by these Terms of
              Service (“Terms”). If you do not agree to these Terms, you may not use the Service.
            </p>
            <p style="margin:10px 0 0;">
              {appName} provides cloud-based software for construction and trade businesses to manage
              projects, finances, timesheets, invoices, payments, and related operational data.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">2. Eligibility</h2>
            <p style="margin:0;">
              You must be at least 18 years old and capable of forming a legally binding agreement to
              use the Service.
            </p>
            <p style="margin:10px 0 0;">
              If you use the Service on behalf of a company or organization, you represent that you have
              authority to bind that entity to these Terms.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">3. Account Registration</h2>
            <p style="margin:0;">
              To use certain features, you must create an account and provide accurate information.
            </p>
            <p style="margin:10px 0 0;">
              You are responsible for maintaining the confidentiality of your login credentials, all
              activity occurring under your account, and ensuring your information remains accurate and up to date.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">4. Acceptable Use</h2>
            <p style="margin:0;">
              You agree not to use the Service to violate any applicable law, store or transmit malicious
              code, interfere with system integrity or performance, access another customer’s data without
              authorization, or engage in fraudulent, deceptive, or harmful activity.
            </p>
            <p style="margin:10px 0 0;">
              We reserve the right to suspend or terminate accounts that violate these rules.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">5. Customer Data</h2>
            <p style="margin:0;">
              You retain ownership of all data you input into the Service (“Customer Data”).
            </p>
            <p style="margin:10px 0 0;">
              By using the Service, you grant {appName} a limited license to host, store, process,
              and transmit Customer Data solely for the purpose of providing and improving the Service.
            </p>
            <p style="margin:10px 0 0;">
              You are responsible for the accuracy, legality, and integrity of your Customer Data.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">6. Data Security</h2>
            <p style="margin:0;">
              We implement reasonable technical measures intended to protect Customer Data. However, no
              system can guarantee absolute security, and you acknowledge that you transmit data at your own risk.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">7. Service Availability</h2>
            <p style="margin:0;">
              We strive to maintain reliable service but do not guarantee uninterrupted or error-free
              operation. The Service may be unavailable due to maintenance, technical issues, network
              disruptions, third-party failures, or events beyond our control.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">8. Fees and Payment</h2>
            <p style="margin:0;">
              If the Service requires payment, fees will be disclosed before purchase. Payments are due
              according to the selected billing arrangement.
            </p>
            <p style="margin:10px 0 0;">
              Unless otherwise stated in writing, fees are non-refundable. Failure to pay may result in
              suspension or termination of access.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">9. Account Termination</h2>
            <p style="margin:0;">
              You may stop using the Service at any time. We may suspend or terminate accounts that violate
              these Terms, fail to satisfy payment obligations, or create risk to the Service, other users,
              or our business.
            </p>
            <p style="margin:10px 0 0;">
              Upon termination, access to your data may be removed after a reasonable retention period.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">10. Intellectual Property</h2>
            <p style="margin:0;">
              All software, design, branding, trademarks, and content associated with the Service are owned
              by {appName} or its licensors and protected by applicable intellectual property laws.
            </p>
            <p style="margin:10px 0 0;">
              You are granted a limited, non-exclusive, non-transferable license to use the Service in
              accordance with these Terms.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">11. Third-Party Services</h2>
            <p style="margin:0;">
              The Service may integrate with or rely on third-party providers. We are not responsible for
              the performance, availability, or policies of those third-party services.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">12. Disclaimer of Warranties</h2>
            <p style="margin:0;">
              The Service is provided “AS IS” and “AS AVAILABLE” without warranties of any kind, whether
              express or implied, including warranties of merchantability, fitness for a particular purpose,
              non-infringement, or uninterrupted availability.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">13. Limitation of Liability</h2>
            <p style="margin:0;">
              To the maximum extent permitted by law, {appName} shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, including loss of profits, data,
              or business opportunities.
            </p>
            <p style="margin:10px 0 0;">
              Our total liability shall not exceed the amount paid by you for the Service during the twelve
              months preceding the claim.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">14. Indemnification</h2>
            <p style="margin:0;">
              You agree to indemnify and hold harmless {appName} from claims, liabilities, damages, and
              expenses arising from your use of the Service, your violation of these Terms, or your violation
              of any law or third-party rights.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">15. Modifications</h2>
            <p style="margin:0;">
              We may modify the Service or these Terms from time to time. Continued use of the Service after
              changes become effective constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">16. Governing Law</h2>
            <p style="margin:0;">
              These Terms shall be governed by the laws of the jurisdiction in which {appName} operates,
              without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 style="margin:0 0 8px; font-size:20px; color:#0F172A;">17. Contact</h2>
            <p style="margin:0;">
              Questions about these Terms may be sent to:
            </p>
            <p style="margin:10px 0 0;">
              christopher.hudson.work@gmail.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;