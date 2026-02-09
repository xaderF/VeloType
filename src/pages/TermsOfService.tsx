export default function TermsOfService() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-foreground">
      <h1 className="mb-8 text-3xl font-bold">Terms of Service</h1>
      <p className="mb-4 text-sm text-muted-foreground">Last updated: February 9, 2026</p>

      <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
        <p>
          By accessing or using VeloType ("the Service"), you agree to be bound by these Terms of
          Service. If you do not agree, please do not use the Service.
        </p>

        <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
        <p>
          VeloType is an online competitive typing game that allows users to practice typing, compete
          in ranked matches, participate in daily challenges, and view leaderboards.
        </p>

        <h2 className="text-lg font-semibold text-foreground">3. User Accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your credentials and for all
          activity under your account. You agree to provide accurate information when registering and to
          notify us promptly of any unauthorized use.
        </p>

        <h2 className="text-lg font-semibold text-foreground">4. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Use automated tools, bots, or scripts to interact with the Service.</li>
          <li>Exploit bugs, exploits, or vulnerabilities to gain an unfair advantage.</li>
          <li>Harass, abuse, or threaten other users.</li>
          <li>Attempt to interfere with the proper functioning of the Service.</li>
          <li>Create multiple accounts to manipulate rankings.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">5. Intellectual Property</h2>
        <p>
          The VeloType source code is available under the MIT License. However, the Service (including
          its design, branding, and user-generated data) remains the property of its operators.
        </p>

        <h2 className="text-lg font-semibold text-foreground">6. Termination</h2>
        <p>
          We reserve the right to suspend or terminate your access at our sole discretion, with or
          without notice, for conduct that we believe violates these Terms or is harmful to other users.
        </p>

        <h2 className="text-lg font-semibold text-foreground">7. Disclaimer of Warranties</h2>
        <p>
          The Service is provided "as is" and "as available" without warranties of any kind, either
          express or implied, including but not limited to implied warranties of merchantability and
          fitness for a particular purpose.
        </p>

        <h2 className="text-lg font-semibold text-foreground">8. Limitation of Liability</h2>
        <p>
          In no event shall VeloType or its operators be liable for any indirect, incidental, special,
          consequential, or punitive damages arising out of or relating to your use of the Service.
        </p>

        <h2 className="text-lg font-semibold text-foreground">9. Changes to Terms</h2>
        <p>
          We may modify these Terms at any time. Continued use of the Service after changes constitutes
          acceptance of the updated Terms.
        </p>

        <h2 className="text-lg font-semibold text-foreground">10. Contact</h2>
        <p>
          Questions about these Terms? Contact us at{' '}
          <a href="mailto:legal@velotype.dev" className="text-primary underline">
            legal@velotype.dev
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
