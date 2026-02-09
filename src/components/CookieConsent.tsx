import { useState, useEffect } from 'react';

const CONSENT_KEY = 'velotype_cookie_consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner only if user hasn't already accepted
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 pointer-events-none" role="alertdialog" aria-label="Cookie consent" aria-describedby="cookie-consent-desc">
      <div className="mx-auto max-w-xl pointer-events-auto rounded-lg border border-border bg-card/95 backdrop-blur-md shadow-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p id="cookie-consent-desc" className="text-sm text-muted-foreground flex-1">
          VeloType uses local storage to keep you logged in and save your preferences. No third-party
          tracking cookies are used. See our{' '}
          <a href="/privacy" className="text-primary underline">
            Privacy Policy
          </a>{' '}
          for details.
        </p>
        <button
          onClick={accept}
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
