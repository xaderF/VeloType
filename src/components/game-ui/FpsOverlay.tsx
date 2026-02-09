import { useEffect, useState } from 'react';

interface FpsOverlayProps {
  isVisible: boolean;
}

export function FpsOverlay({ isVisible }: FpsOverlayProps) {
  const [fps, setFps] = useState(0);
  const [frameMs, setFrameMs] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    let rafId = 0;
    let frameCount = 0;
    let frameTimeSum = 0;
    let lastFrameAt = performance.now();
    let lastUiUpdateAt = lastFrameAt;

    const tick = (now: number) => {
      if (document.hidden) {
        lastFrameAt = now;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const delta = now - lastFrameAt;
      lastFrameAt = now;

      if (delta > 0 && delta < 1000) {
        frameCount += 1;
        frameTimeSum += delta;
      }

      const windowMs = now - lastUiUpdateAt;
      if (windowMs >= 500) {
        setFps(Math.round((frameCount * 1000) / windowMs));
        setFrameMs(Math.round((frameTimeSum / Math.max(frameCount, 1)) * 10) / 10);
        frameCount = 0;
        frameTimeSum = 0;
        lastUiUpdateAt = now;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none rounded-lg border border-border bg-card/80 backdrop-blur-sm px-3 py-2 text-xs font-mono text-muted-foreground">
      <div>FPS: {fps}</div>
      <div>Frame: {frameMs}ms</div>
    </div>
  );
}
