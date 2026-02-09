// TypingDisplay: Displays the text to be typed. Used in TypingArena.
// Depends on: cn util.
// Props: text, typed, currentIndex, className.
import { memo, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Memoised single-character cell — only re-renders when its own state changes.
// ---------------------------------------------------------------------------
interface CharCellProps {
  char: string;
  status: 'pending' | 'correct' | 'error';
  isCurrent: boolean;
}

const STATUS_CLASS: Record<CharCellProps['status'], string> = {
  pending: 'text-typing-pending',
  correct: 'text-typing-correct',
  error: 'text-typing-error',
};

const CharCell = memo(function CharCell({ char, status, isCurrent }: CharCellProps) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (isCurrent) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [isCurrent]);

  return (
    <span className="relative inline-block">
      <span
        ref={isCurrent ? ref : undefined}
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
}

export const TypingDisplay = memo(function TypingDisplay({
  text,
  typed,
  currentIndex,
  textSize,
  className,
}: TypingDisplayProps) {
  // Pre-compute a flat status array so word rendering is pure.
  const statuses = useMemo(() => {
    const out = new Array<CharCellProps['status']>(text.length);
    for (let i = 0; i < text.length; i++) {
      if (i >= typed.length) {
        out[i] = 'pending';
      } else if (typed[i] === text[i]) {
        out[i] = 'correct';
      } else {
        out[i] = 'error';
      }
    }
    return out;
  }, [text, typed]);

  // Split into words once (text never changes mid-render).
  const words = useMemo(() => text.split(/(\s+)/), [text]);

  let charIndex = 0;

  return (
    <div
      className={cn(
        'relative font-mono leading-relaxed select-none break-words whitespace-pre-wrap overflow-hidden',
        textSize ?? 'text-2xl md:text-3xl',
        className,
      )}
      role="application"
      aria-label="Typing area — type the displayed text"
      aria-roledescription="typing test"
    >
      {words.map((word, wIdx) => {
        const startIdx = charIndex;
        charIndex += word.length;
        return (
          <span key={wIdx} className="inline-block">
            {word.split('').map((char, cIdx) => {
              const idx = startIdx + cIdx;
              return (
                <CharCell
                  key={cIdx}
                  char={char}
                  status={statuses[idx]}
                  isCurrent={idx === currentIndex}
                />
              );
            })}
          </span>
        );
      })}
    </div>
  );
});
