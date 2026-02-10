import { cn } from '@/lib/utils';

const TIME_OPTIONS = [15, 30, 60, 120] as const;

interface TypingOptionsBarProps {
  wordsEnabled?: boolean;
  punctuationEnabled: boolean;
  numbersEnabled?: boolean;
  timeLimit: number;
  allowEndless?: boolean;
  onToggleWords?: () => void;
  onTogglePunctuation?: () => void;
  onToggleNumbers?: () => void;
  onTimeLimitChange?: (seconds: number) => void;
  className?: string;
}

function getButtonClass(active: boolean, interactive: boolean) {
  if (active) {
    return 'bg-primary/15 text-primary border border-primary/40';
  }
  if (!interactive) {
    return 'text-muted-foreground/60 border border-transparent';
  }
  return 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent';
}

export function TypingOptionsBar({
  wordsEnabled = true,
  punctuationEnabled,
  numbersEnabled = false,
  timeLimit,
  allowEndless = false,
  onToggleWords,
  onTogglePunctuation,
  onToggleNumbers,
  onTimeLimitChange,
  className,
}: TypingOptionsBarProps) {
  const canToggleWords = typeof onToggleWords === 'function';
  const canTogglePunctuation = typeof onTogglePunctuation === 'function';
  const canToggleNumbers = typeof onToggleNumbers === 'function';
  const showNumbersToggle = canToggleNumbers || numbersEnabled;
  const canChangeTime = typeof onTimeLimitChange === 'function';

  return (
    <div
      className={cn(
        'w-full rounded-xl border border-border bg-card/60 px-3 py-2 backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={onToggleWords}
          disabled={!canToggleWords}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors md:text-sm',
            getButtonClass(wordsEnabled, canToggleWords),
          )}
        >
          words
        </button>

        <span className="hidden h-5 w-px bg-border/70 md:block" />

        <button
          type="button"
          onClick={onTogglePunctuation}
          disabled={!canTogglePunctuation}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors md:text-sm',
            getButtonClass(punctuationEnabled, canTogglePunctuation),
          )}
        >
          punctuation
        </button>

        {showNumbersToggle && (
          <button
            type="button"
            onClick={onToggleNumbers}
            disabled={!canToggleNumbers}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors md:text-sm',
              getButtonClass(numbersEnabled, canToggleNumbers),
            )}
          >
            numbers
          </button>
        )}

        <span className="hidden h-5 w-px bg-border/70 md:block" />

        {TIME_OPTIONS.map((seconds) => (
          <button
            key={seconds}
            type="button"
            onClick={() => onTimeLimitChange?.(seconds)}
            disabled={!canChangeTime}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors md:text-sm',
              getButtonClass(timeLimit === seconds, canChangeTime),
            )}
          >
            {seconds}
          </button>
        ))}

        {allowEndless && (
          <button
            type="button"
            onClick={() => onTimeLimitChange?.(0)}
            disabled={!canChangeTime}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors md:text-sm',
              getButtonClass(timeLimit === 0, canChangeTime),
            )}
          >
            ∞
          </button>
        )}
      </div>
    </div>
  );
}
