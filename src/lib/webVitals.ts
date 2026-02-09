// ---------------------------------------------------------------------------
// Web Vitals — lightweight production performance monitoring.
//
// Reports Core Web Vitals (LCP, FID, CLS, INP, TTFB) to the console in dev
// and can be wired to an analytics endpoint in production.
// ---------------------------------------------------------------------------

type MetricReport = {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
};

/**
 * Collects Web Vitals using the native PerformanceObserver API.
 * Falls back gracefully if a metric isn't supported by the browser.
 */
export function reportWebVitals(onReport?: (metric: MetricReport) => void) {
  const send = onReport ?? ((m: MetricReport) => {
    if (import.meta.env.DEV) {
      console.log(`[Web Vital] ${m.name}: ${Math.round(m.value)}ms (${m.rating})`);
    }
  });

  // ---- Largest Contentful Paint ----
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      if (last) {
        const value = last.startTime;
        send({
          name: 'LCP',
          value,
          rating: value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor',
          delta: value,
          id: `lcp-${Date.now()}`,
        });
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* unsupported */ }

  // ---- First Input Delay ----
  try {
    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { processingStart: number; startTime: number };
        const value = e.processingStart - e.startTime;
        send({
          name: 'FID',
          value,
          rating: value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor',
          delta: value,
          id: `fid-${Date.now()}`,
        });
      }
    });
    fidObserver.observe({ type: 'first-input', buffered: true });
  } catch { /* unsupported */ }

  // ---- Cumulative Layout Shift ----
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!e.hadRecentInput) clsValue += e.value;
      }
      send({
        name: 'CLS',
        value: clsValue,
        rating: clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor',
        delta: clsValue,
        id: `cls-${Date.now()}`,
      });
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch { /* unsupported */ }

  // ---- Time to First Byte ----
  try {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length) {
      const value = navEntries[0].responseStart;
      send({
        name: 'TTFB',
        value,
        rating: value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor',
        delta: value,
        id: `ttfb-${Date.now()}`,
      });
    }
  } catch { /* unsupported */ }
}
