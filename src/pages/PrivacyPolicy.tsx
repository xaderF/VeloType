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

        <h2 className="text-lg font-semibold text-foreground">3. Legal Basis for Processing (GDPR)</h2>
        <p>
          If you are located in the European Economic Area (EEA), our legal basis for processing your
          personal data includes:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Contract performance:</strong> Processing necessary to provide you with the Service (account management, matchmaking, leaderboards).</li>
          <li><strong>Consent:</strong> When you explicitly agree to our Terms of Service and Privacy Policy during registration.</li>
          <li><strong>Legitimate interests:</strong> Improving the Service, preventing fraud and abuse, and ensuring platform security.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">4. Data Storage &amp; Security</h2>
        <p>
          Passwords are hashed with scrypt before storage. Authentication tokens are signed with
          HMAC-SHA256 and expire after a fixed period. We use industry-standard practices to protect
          your data, though no method of electronic storage is 100&nbsp;% secure.
        </p>

        <h2 className="text-lg font-semibold text-foreground">5. Data Retention</h2>
        <p>
          We retain your personal data for as long as your account remains active. Match history and
          performance data are kept indefinitely while your account exists to support leaderboard and
          career statistics features. If you delete your account, all personal data (profile, ratings,
          match records, and daily scores) is permanently erased within 24&nbsp;hours.
        </p>
        <p>
          Anonymous, aggregated statistics (e.g.&nbsp;total matches played across all users) may be
          retained after account deletion as they cannot be linked back to you.
        </p>

        <h2 className="text-lg font-semibold text-foreground">6. Cookies &amp; Local Storage</h2>
        <p>
          VeloType stores your authentication token, cookie consent preference, and basic settings in
          your browser&rsquo;s local storage. We do not use tracking cookies or third-party analytics.
          By using VeloType, you consent to the use of essential local storage as described here. You
          can clear this data at any time through your browser settings.
        </p>

        <h2 className="text-lg font-semibold text-foreground">7. Your Rights</h2>
        <p>
          You have the right to access, correct, export, and delete your personal data:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Access &amp; Correction:</strong> Update your username and email via your <a href="/profile" className="text-primary underline">profile page</a>.</li>
          <li><strong>Data Export (Portability):</strong> Download all your data as a JSON file from the "Account &amp; Data" section of your <a href="/profile" className="text-primary underline">profile page</a>.</li>
          <li><strong>Account Deletion (Right to Erasure):</strong> Permanently delete your account and all associated data from the "Account &amp; Data" section of your <a href="/profile" className="text-primary underline">profile page</a>.</li>
        </ul>
        <p>
          For EEA residents: you also have the right to restrict processing, object to processing, and
          lodge a complaint with your local data protection authority. Contact us at the email below to
          exercise these rights if you cannot do so through the self-service options above.
        </p>

        <h2 className="text-lg font-semibold text-foreground">8. International Data Transfers</h2>
        <p>
          Your data may be processed on servers outside your country of residence. Where required, we
          rely on standard contractual clauses or other appropriate safeguards to ensure adequate
          protection.
        </p>

        <h2 className="text-lg font-semibold text-foreground">9. Children&rsquo;s Privacy</h2>
        <p>
          VeloType is not directed at children under 13. We do not knowingly collect personal
          information from children under 13 in compliance with COPPA. If you believe a child has
          provided us with personal data, please contact us so we can remove it.
        </p>

        <h2 className="text-lg font-semibold text-foreground">10. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. We will notify you of material changes by posting
          the new policy on this page and updating the "Last updated" date.
        </p>

        <h2 className="text-lg font-semibold text-foreground">11. Contact</h2>
        <p>
          If you have questions about this Privacy Policy or wish to exercise your data rights, please
          contact us at{' '}
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
