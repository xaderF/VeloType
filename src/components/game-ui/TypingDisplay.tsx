// TypingDisplay: Displays the text to be typed. Used in TypingArena.
// Depends on: cn util.
// Props: text, typed, currentIndex, className.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Memoised single-character cell — only re-renders when its own state changes.
// ---------------------------------------------------------------------------
interface CharCellProps {
  char: string;
  status: 'pending' | 'correct' | 'error';
  isCurrent: boolean;
  currentCharRef?: (element: HTMLSpanElement | null) => void;
}

const STATUS_CLASS: Record<CharCellProps['status'], string> = {
  pending: 'text-typing-pending',
  correct: 'text-typing-correct',
  error: 'text-typing-error',
};

const CharCell = memo(function CharCell({ char, status, isCurrent, currentCharRef }: CharCellProps) {
  return (
    <span ref={isCurrent ? currentCharRef : undefined} className="relative inline-block">
      <span
        className={cn(STATUS_CLASS[status], 'transition-colors duration-75')}
      >
        {char === ' ' ? '\u00A0' : char}
      </span>
      {isCurrent && (
        <span className="typing-caret absolute left-[-0.08em] top-[0.12em] h-[1.05em] w-[2px] rounded-full bg-primary" />
      )}
    </span>
  );
});

// ---------------------------------------------------------------------------
// TypingDisplay — the visible text the player types against.
// ---------------------------------------------------------------------------
interface TypingDisplayProps {
  text: string;
  typed: string;
  currentIndex: number;
  /** Override font size classes (defaults to 'text-2xl md:text-3xl') */
  textSize?: string;
  className?: string;
  lineCount?: number;
}

export const TypingDisplay = memo(function TypingDisplay({
  text,
  typed,
  currentIndex,
  textSize,
  className,
  lineCount = 3,
}: TypingDisplayProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const currentCharRef = useRef<HTMLSpanElement | null>(null);
  const [lineHeightPx, setLineHeightPx] = useState<number | null>(null);
  const [translateY, setTranslateY] = useState(0);
  const setCurrentCharRef = useCallback((element: HTMLSpanElement | null) => {
    currentCharRef.current = element;
  }, []);

  const { windowStart, windowText } = useMemo(() => {
    const LOOK_BEHIND = 240;
    const LOOK_AHEAD = 900;
    const safeIndex = Math.max(0, Math.min(currentIndex, Math.max(0, text.length - 1)));

    let start = Math.max(0, safeIndex - LOOK_BEHIND);
    let end = Math.min(text.length, currentIndex + LOOK_AHEAD);

    const prevSpace = text.lastIndexOf(' ', start);
    if (prevSpace >= 0) start = prevSpace + 1;

    const nextSpace = text.indexOf(' ', end);
    if (nextSpace >= 0) end = nextSpace;

    if (end <= start) end = Math.min(text.length, start + 1);

    return {
      windowStart: start,
      windowText: text.slice(start, end),
    };
  }, [currentIndex, text]);

  // Pre-compute status for only the currently rendered window.
  const statuses = useMemo(() => {
    const out = new Array<CharCellProps['status']>(windowText.length);
    for (let i = 0; i < windowText.length; i += 1) {
      const globalIndex = windowStart + i;
      if (globalIndex >= typed.length) {
        out[i] = 'pending';
      } else if (typed[globalIndex] === text[globalIndex]) {
        out[i] = 'correct';
      } else {
        out[i] = 'error';
      }
    }
    return out;
  }, [text, typed, windowStart, windowText]);

  // Split the rendered window into words once.
  const words = useMemo(() => windowText.split(/(\s+)/), [windowText]);

  useEffect(() => {
    const measureLineHeight = () => {
      const target = innerRef.current ?? viewportRef.current;
      if (!target) return;

      const styles = window.getComputedStyle(target);
      const parsedLineHeight = Number.parseFloat(styles.lineHeight);
      if (Number.isFinite(parsedLineHeight)) {
        setLineHeightPx(parsedLineHeight);
        return;
      }

      const parsedFontSize = Number.parseFloat(styles.fontSize);
      if (Number.isFinite(parsedFontSize)) {
        setLineHeightPx(parsedFontSize * 1.625);
      }
    };

    measureLineHeight();
    window.addEventListener('resize', measureLineHeight);
    return () => window.removeEventListener('resize', measureLineHeight);
  }, [textSize]);

  useEffect(() => {
    const current = currentCharRef.current;
    const inner = innerRef.current;
    if (!current) {
      if (currentIndex === 0) setTranslateY(0);
      return;
    }
    if (!inner) return;

    // Shift as soon as the caret enters the next wrapped line:
    // line 2 becomes visible as line 1, line 3 becomes line 2, etc.
    const currentRect = current.getBoundingClientRect();
    const innerRect = inner.getBoundingClientRect();
    const localTop = Math.max(0, currentRect.top - innerRect.top);
    const nextTranslateY = lineHeightPx && Number.isFinite(lineHeightPx) && lineHeightPx > 0
      ? Math.floor((localTop + lineHeightPx * 0.1) / lineHeightPx) * lineHeightPx
      : localTop;
    setTranslateY(nextTranslateY);
  }, [currentIndex, lineHeightPx, windowStart, windowText.length]);

  const viewportHeight = lineHeightPx
    ? `${lineHeightPx * Math.max(1, lineCount)}px`
    : `${4.875 * Math.max(1, lineCount / 3)}em`;

  let charIndex = windowStart;

  return (
    <div
      className={cn(
        'relative font-mono leading-relaxed select-none',
        textSize ?? 'text-2xl md:text-3xl',
        className,
      )}
      role="application"
      aria-label="Typing area — type the displayed text"
      aria-roledescription="typing test"
    >
      <div
        ref={viewportRef}
        className="overflow-hidden"
        style={{ height: viewportHeight }}
      >
        <div
          ref={innerRef}
          className="break-words whitespace-pre-wrap transition-transform duration-100 ease-linear"
          style={{ transform: `translateY(-${translateY}px)` }}
        >
          {words.map((word, wIdx) => {
            const startIdx = charIndex;
            charIndex += word.length;
            return (
              <span key={`${windowStart}-${wIdx}`} className="inline-block">
                {word.split('').map((char, cIdx) => {
                  const idx = startIdx + cIdx;
                  const localIdx = idx - windowStart;
                  return (
                    <CharCell
                      key={idx}
                      char={char}
                      status={statuses[localIdx]}
                      isCurrent={idx === currentIndex}
                      currentCharRef={setCurrentCharRef}
                    />
                  );
                })}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
});
