import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [{ title: "JobVaro — Privacy Policy" }],
  }),
  component: PrivacyPage,
});

// Small helper for consistent subsection styling.
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-3 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
        {children}
      </div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50 sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-lg text-gray-500 dark:text-gray-400">
          JobVaro — a Product of HRKyle Services
        </p>
        <p className="mt-1 text-sm font-medium text-gray-400 dark:text-gray-500">
          Effective date: August 22, 2026
        </p>
      </div>

      <div className="space-y-10">
        <Section id="overview" title="1. Overview">
          <p>
            This Privacy Policy explains what information JobVaro collects, why we collect it,
            and how it is used. JobVaro is a job search command center that lets you track
            applications, save jobs, browse community-shared jobs, and get AI-assisted
            résumé-to-job matching through the Compass feature.
          </p>
          <p>
            JobVaro is a product of HRKyle Services. If you have questions about this policy or
            your data, contact us at{" "}
            <a
              href="mailto:support@jobvaro.com"
              className="font-medium text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              support@jobvaro.com
            </a>
            .
          </p>
        </Section>

        <Section id="information-collected" title="2. Information We Collect">
          <p>We collect the following categories of information:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <span className="font-medium text-gray-800 dark:text-gray-200">Account data.</span>{" "}
              When you sign up, we collect your email address, your name, and a securely hashed
              version of your password. We never store your password in plain text.
            </li>
            <li>
              <span className="font-medium text-gray-800 dark:text-gray-200">Job-search data.</span>{" "}
              The information you enter or save as part of using JobVaro, including job titles,
              companies, locations, salary information, job URLs, application statuses and notes,
              timeline events, a company watchlist, and saved or community jobs.
            </li>
            <li>
              <span className="font-medium text-gray-800 dark:text-gray-200">Compass inputs.</span>{" "}
              When you use the Compass feature, you submit a résumé, a job, or a match request.
              These inputs are processed to produce a match score and feedback.
            </li>
          </ul>
        </Section>

        <Section id="how-we-use" title="3. How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Operate your account and deliver the features you use;</li>
            <li>
              Verify your email address — we send a confirmation email to the address you provide;
            </li>
            <li>
              Send account and plan notices, including expiry and grace-period reminders related to
              our fixed-term plan policy;
            </li>
            <li>Process payments for paid plans;</li>
            <li>Provide Compass analysis.</li>
          </ul>
        </Section>

        <Section id="email-verification" title="4. Email & Identity Verification">
          <p>
            After you sign up, we send a confirmation link to the email address you provided. You
            must confirm your email before you can sign in to your account. This helps us verify
            that the email address belongs to you and protects your account.
          </p>
        </Section>

        <Section id="payments" title="5. Payments">
          <p>
            Paid plans are one-time purchases processed by{" "}
            <span className="font-medium text-gray-800 dark:text-gray-200">Stripe</span>. Payment
            card details are handled directly by Stripe using their secure, industry-standard
            processing. We do not store full card numbers on our own systems.
          </p>
        </Section>

        <Section id="third-parties" title="6. Third-Party Processors">
          <p>
            To provide our service, we share limited information with the following trusted
            third-party processors:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <span className="font-medium text-gray-800 dark:text-gray-200">Resend</span> — used to
              send transactional and verification email (for example, the email confirmation link).
            </li>
            <li>
              <span className="font-medium text-gray-800 dark:text-gray-200">Stripe</span> — used
              to process payments for paid plans.
            </li>
            <li>
              <span className="font-medium text-gray-800 dark:text-gray-200">OpenAI</span> — used to
              power the Compass AI match analysis. The résumé and job inputs you submit for a
              Compass analysis are sent to this provider to generate your match score and feedback.
            </li>
          </ul>
          <p>
            We do not sell your personal information, and we do not share your data with
            advertisers.
          </p>
        </Section>

        <Section id="cookies" title="7. Cookies & Sessions">
          <p>
            We use a session cookie to keep you signed in to your account. We do not place
            advertising or tracking cookies on your device.
          </p>
        </Section>

        <Section id="retention" title="8. Data Retention & Plan Lapse Policy">
          <p>
            Free accounts can hold up to 5 tracked applications and 1 Compass analysis. Paid plans
            are fixed-term one-time purchases with a defined end date, and they never auto-renew.
          </p>
          <p>
            When a paid plan lapses, your account reverts to the Free plan. Data beyond the free
            limits is locked — kept but inaccessible — for a 30-day grace period. If you renew
            during that period, everything is restored. If you do not renew, data beyond the free
            limits is permanently deleted after the grace period.
          </p>
          <p>
            We send reminders before a plan expires and during the grace period so you are not
            caught by surprise.
          </p>
        </Section>

        <Section id="your-rights" title="9. Your Rights & Control">
          <p>
            You can access and manage the data you have saved in your account at any time. The app
            allows you to delete your own job and application data directly. You may also request
            that your data be deleted by contacting us at{" "}
            <a
              href="mailto:support@jobvaro.com"
              className="font-medium text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              support@jobvaro.com
            </a>
            .
          </p>
          <p>
            As described above, data beyond free limits that is not renewed is permanently deleted
            after the 30-day grace period.
          </p>
        </Section>

        <Section id="security" title="10. Data Security">
          <p>
            We take reasonable measures to protect your information, including hashing passwords
            and relying on trusted payment and email providers for their respective functions.
            No method of transmission or storage is 100% secure, but we work to protect the data we
            hold.
          </p>
        </Section>

        <Section id="children" title="11. Children's Privacy">
          <p>
            JobVaro is not directed at children under the age of 16, and we do not knowingly collect
            personal information from children under 16. If you believe a child has provided us
            with personal information, please contact us so we can remove it.
          </p>
        </Section>

        <Section id="changes" title="12. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our practices
            or for other operational, legal, or regulatory reasons. When we do, we will post the
            updated policy on this page with a new effective date.
          </p>
        </Section>

        <Section id="contact" title="13. Contact Us">
          <p>
            If you have questions or concerns about this Privacy Policy or how your data is
            handled, please contact us at{" "}
            <a
              href="mailto:support@jobvaro.com"
              className="font-medium text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              support@jobvaro.com
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}
