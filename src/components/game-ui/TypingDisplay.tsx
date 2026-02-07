// TypingDisplay: Displays the text to be typed. Used in TypingArena.
// Depends on: cn util.
// Props: text, typed, currentIndex, className.
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TypingDisplayProps {
  text: string;
  typed: string;
  currentIndex: number;
  className?: string;
}

export function TypingDisplay({ text, typed, currentIndex, className }: TypingDisplayProps) {
  const words = text.split(/(\s+)/); // Split by spaces, keep spaces
  const currentRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, [currentIndex]);

  // Track character index for cursor
  let charIndex = 0;

  return (
    <div
      className={cn(
        "relative font-mono text-2xl md:text-3xl leading-relaxed select-none break-words whitespace-pre-wrap overflow-hidden",
        className
      )}
    >
      {words.map((word, wIdx) => {
        // Render each word as a span, then each char inside
        return (
          <span key={wIdx} className="inline-block">
            {word.split('').map((char, cIdx) => {
              const index = charIndex;
              const typedChar = typed[index];
              const hasTyped = index < typed.length;
              const isCurrentChar = index === currentIndex;

              let charClass = 'text-typing-pending';
              if (hasTyped && typedChar === char) {
                charClass = 'text-typing-correct';
              } else if (hasTyped && typedChar !== char) {
                charClass = 'text-typing-error';
              }

              charIndex++;

              return (
                <span key={cIdx} className="relative inline-block">
                  <span
                    ref={isCurrentChar ? currentRef : null}
                    className={cn(charClass, "transition-colors duration-75")}
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </span>
                  {isCurrentChar && (
                    <span
                      className="typing-caret absolute left-[-0.08em] top-[0.12em] h-[1.05em] w-[2px] rounded-full bg-primary"
                    />
                  )}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}
