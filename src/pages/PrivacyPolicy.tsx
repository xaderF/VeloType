export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-foreground">
      <h1 className="mb-8 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-4 text-sm text-muted-foreground">Last updated: February 9, 2026</p>

      <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
        <p>
          When you create an account we collect the information you provide — a username, an optional
          email address, and (if you use password authentication) a securely hashed password. If you
          sign in through a third-party OAuth provider we receive a provider-specific user ID and, where
          available, your email address.
        </p>
        <p>
          During gameplay we record match performance data such as words-per-minute, accuracy,
          consistency, and per-second progress samples. These are linked to your account for leaderboard
          and match-history features.
        </p>

        <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
        <p>
          We use your data solely to operate and improve VeloType — authenticating your sessions,
          calculating rankings, displaying leaderboards, and providing match history. We do not sell or
          share your personal information with third parties for marketing purposes.
        </p>

        <h2 className="text-lg font-semibold text-foreground">3. Data Storage &amp; Security</h2>
        <p>
          Passwords are hashed with scrypt before storage. Authentication tokens are signed with
          HMAC-SHA256 and expire after a fixed period. We use industry-standard practices to protect
          your data, though no method of electronic storage is 100&nbsp;% secure.
        </p>

        <h2 className="text-lg font-semibold text-foreground">4. Cookies &amp; Local Storage</h2>
        <p>
          VeloType stores your authentication token and basic preferences in your browser&rsquo;s local
          storage. A single functional cookie may be used for UI state (e.g.&nbsp;sidebar position). We
          do not use tracking cookies or third-party analytics at this time.
        </p>

        <h2 className="text-lg font-semibold text-foreground">5. Your Rights</h2>
        <p>
          You may update your username and email via your profile page. If you wish to export or delete
          your data, please contact us at the email below. We will respond within 30&nbsp;days.
        </p>

        <h2 className="text-lg font-semibold text-foreground">6. Children&rsquo;s Privacy</h2>
        <p>
          VeloType is not directed at children under 13. We do not knowingly collect personal
          information from children. If you believe a child has provided us with personal data, please
          contact us so we can remove it.
        </p>

        <h2 className="text-lg font-semibold text-foreground">7. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. We will notify you of material changes by posting
          the new policy on this page and updating the "Last updated" date.
        </p>

        <h2 className="text-lg font-semibold text-foreground">8. Contact</h2>
        <p>
          If you have questions about this Privacy Policy, please contact us at{' '}
          <a href="mailto:privacy@velotype.dev" className="text-primary underline">
            privacy@velotype.dev
          </a>
          .
        </p>
      </section>

      <div className="mt-12 text-center">
        <a href="/" className="text-sm text-primary underline">
          ← Back to VeloType
        </a>
      </div>
    </div>
  );
}
