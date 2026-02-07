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
  className?: string;
}

export function TypingArena({
  text,
  isActive,
  timeLimit = 30,
  onComplete,
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

  return (
    <motion.div
      ref={containerRef}
      className={cn(
        "relative w-full cursor-text",
        !isActive && "opacity-50 pointer-events-none",
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
      <div className="p-8 rounded-xl border border-border bg-card">
        {/* Live stats bar */}
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
          
          {/* Progress indicator */}
          <div className="text-sm text-muted-foreground">
            {state.cursor} / {state.target.length} characters
          </div>
        </div>

        {/* Text display */}
        <TypingDisplay
          text={state.target}
          typed={state.typed}
          currentIndex={state.cursor}
          className="min-h-[120px]"
        />

        {/* Progress bar */}
        <div className="mt-6 h-1 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

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

        {/* Completion message */}
        {state.status === 'finished' && (
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
