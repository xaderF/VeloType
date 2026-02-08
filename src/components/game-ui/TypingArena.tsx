// TypingArena: Main game area for typing matches. Uses TypingDisplay, RoundEndOverlay, CountdownOverlay.
// Depends on: TypingDisplay, useTypingEngine, RoundStats, cn util.
// Props: text, isActive.
import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TypingDisplay } from './TypingDisplay';
import { useTypingEngine } from '@/hooks/useTypingEngine';
import { RoundStats } from '@/utils/scoring';
import { cn } from '@/lib/utils';

interface TypingArenaProps {
  text: string;
  isActive: boolean;
  timeLimit?: number;
  onComplete?: (stats: RoundStats) => void;
  /** Called alongside onComplete with the raw typed string and per-second samples (for online mode) */
  onCompleteRaw?: (typed: string, samples: number[]) => void;
  /** Called every ~500ms with the current typing state (for online progress reporting) */
  onProgressUpdate?: (typed: string, cursor: number, errors: number, startedAtMs: number | null) => void;
  /** Hide distracting UI for a clean, Monkeytype-style focus experience */
  focusMode?: boolean;
  /** Timer starts on first keystroke instead of immediately (used by free type) */
  startOnFirstKeystroke?: boolean;
  className?: string;
}

export function TypingArena({
  text,
  isActive,
  timeLimit = 30,
  onComplete,
  onCompleteRaw,
  onProgressUpdate,
  focusMode = false,
  startOnFirstKeystroke: startOnFirstKeystrokeProp,
  className,
}: TypingArenaProps) {
  const {
    state,
    timeRemaining,
    inputRef,
    handleKeyDown,
    metrics,
    progress,
  } = useTypingEngine({
    text,
    isActive,
    onComplete,
    timeLimit,
    startOnFirstKeystroke: startOnFirstKeystrokeProp ?? focusMode,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const accuracyPercent = Math.round((metrics.accuracy || 0) * 100);

  // Focus container on click
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = () => {
      inputRef.current?.focus();
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [inputRef]);

  // Auto-focus when active
  useEffect(() => {
    if (isActive) {
      inputRef.current?.focus();
    }
  }, [isActive, inputRef]);

  // Report raw typed text + samples when finished (online mode)
  useEffect(() => {
    if (state.status === 'finished' && onCompleteRaw) {
      onCompleteRaw(state.typed, state.samples);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // Report progress periodically (online mode)
  useEffect(() => {
    if (!isActive || !onProgressUpdate || state.status === 'finished') return;
    const id = setInterval(() => {
      onProgressUpdate(state.typed, state.cursor, state.errors, state.startedAtMs);
    }, 500);
    return () => clearInterval(id);
  }, [isActive, onProgressUpdate, state.typed, state.cursor, state.errors, state.startedAtMs, state.status]);

  return (
    <motion.div
      ref={containerRef}
      className={cn(
        "relative w-full cursor-text",
        !isActive && "pointer-events-none",
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Hidden input for capturing keystrokes */}
      <input
        ref={inputRef}
        type="text"
        className="absolute opacity-0 pointer-events-none"
        onKeyDown={handleKeyDown}
        autoFocus={isActive}
        disabled={!isActive}
      />

      {/* Typing area */}
      <div className={cn(
        "p-8 rounded-xl",
        !focusMode && "border border-border bg-card",
      )}>
        {/* Live stats bar — hidden in focus mode */}
        {!focusMode && (
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold font-mono text-primary">
                  {Math.round(metrics.wpm) || 0}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  WPM
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-mono">
                  {accuracyPercent}%
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Accuracy
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-mono text-damage">
                  {metrics.errors || 0}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Errors
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-xl font-bold font-mono text-primary">
                {timeRemaining}s
              </div>
              <div className="text-xs text-muted-foreground">
                {state.cursor} / {state.target.length} chars
              </div>
            </div>
          </div>
        )}

        {/* Focus mode: minimal timer only */}
        {focusMode && state.startedAtMs && state.status !== 'finished' && (
          <div className="mb-6 text-center">
            <span className="text-4xl font-mono font-bold text-primary">
              {timeRemaining}
            </span>
          </div>
        )}

        {/* Text display */}
        <TypingDisplay
          text={state.target}
          typed={state.typed}
          currentIndex={state.cursor}
          textSize={focusMode ? "text-3xl md:text-4xl" : undefined}
          className="min-h-[120px]"
        />

        {/* Progress bar — hidden in focus mode */}
        {!focusMode && (
          <div className="mt-6 h-1 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        )}

        {/* Focus hint */}
        {isActive && !state.startedAtMs && (
          <motion.div
            className="mt-4 text-center text-muted-foreground text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Click here or start typing to begin...
          </motion.div>
        )}

        {/* Completion message — only in non-focus mode */}
        {!focusMode && state.status === 'finished' && (
          <motion.div
            className="mt-4 text-center text-hp-full font-semibold"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            ✓ Complete! Waiting for opponent...
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
