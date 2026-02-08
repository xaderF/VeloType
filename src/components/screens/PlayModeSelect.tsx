import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LetterParticles } from '@/components/game-ui/LetterParticles';

export type GameMode = 'competitive' | 'bot' | 'freetype';

interface ModeTab {
  id: GameMode;
  title: string;
  subtitle: string;
  description: string;
}

const MODES: ModeTab[] = [
  {
    id: 'competitive',
    title: 'COMPETITIVE',
    subtitle: 'Ranked 1v1',
    description: 'Live matchmaking with rating impact. Server-authoritative scoring and damage resolution.',
  },
  {
    id: 'bot',
    title: 'VERSUS BOT',
    subtitle: 'Quick Match',
    description: 'Fight an AI opponent and practice pressure rounds without affecting your ranked profile.',
  },
  {
    id: 'freetype',
    title: 'FREE TYPE',
    subtitle: 'Solo Run',
    description: 'Pure typing session for speed and consistency. No opponent, no rank risk.',
  },
];

export interface PlayModeSelectProps {
  isVisible: boolean;
  isAuthenticated: boolean;
  username?: string;
  rating?: number | null;
  isCompetitiveQueueing: boolean;
  competitiveQueueTime: number;
  onStartCompetitiveQueue: () => void;
  onCancelCompetitiveQueue: () => void;
  onStartBot: () => void;
  onStartFreeType: () => void;
  onBack: () => void;
  onLogin: () => void;
}

function formatTime(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function PlayModeSelect({
  isVisible,
  isAuthenticated,
  username,
  rating,
  isCompetitiveQueueing,
  competitiveQueueTime,
  onStartCompetitiveQueue,
  onCancelCompetitiveQueue,
  onStartBot,
  onStartFreeType,
  onBack,
  onLogin,
}: PlayModeSelectProps) {
  const [activeMode, setActiveMode] = useState<GameMode>('competitive');

  useEffect(() => {
    if (isCompetitiveQueueing) setActiveMode('competitive');
  }, [isCompetitiveQueueing]);

  const active = useMemo(() => MODES.find((m) => m.id === activeMode) ?? MODES[0], [activeMode]);
  const isCompetitiveMode = activeMode === 'competitive';
  const isCompetitiveInQueue = isCompetitiveMode && isCompetitiveQueueing;

  const handlePrimaryAction = () => {
    if (isCompetitiveMode) {
      if (!isAuthenticated) {
        onLogin();
        return;
      }
      if (isCompetitiveQueueing) {
        onCancelCompetitiveQueue();
        return;
      }
      onStartCompetitiveQueue();
      return;
    }

    if (activeMode === 'bot') {
      onStartBot();
      return;
    }

    onStartFreeType();
  };

  const primaryLabel = activeMode === 'competitive'
    ? isCompetitiveQueueing
      ? 'IN QUEUE'
      : 'START'
    : activeMode === 'bot'
      ? 'START VERSUS BOT'
      : 'START FREE TYPE';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col bg-lobby-bg overflow-hidden select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <LetterParticles />

          <div className="relative z-10 flex items-center justify-between px-8 md:px-12 pt-7 pb-5 border-b border-lobby-text-muted/15">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-xs md:text-sm font-semibold tracking-[0.2em] uppercase text-lobby-text-muted hover:text-lobby-text transition-colors"
            >
              <span className="text-base">←</span>
              Back
            </button>
            <h1 className="text-xl md:text-3xl font-bold tracking-[0.25em] uppercase text-lobby-text">
              Play
            </h1>
            <div className="w-16 md:w-24" />
          </div>

          <div className="relative z-10 px-5 md:px-10 pt-4">
            <div className="mx-auto max-w-6xl overflow-x-auto">
              <div className="inline-flex min-w-full md:min-w-0 md:flex w-full justify-start md:justify-center gap-1 md:gap-2">
                {MODES.map((mode) => {
                  const isActive = activeMode === mode.id;
                  const disabled = isCompetitiveQueueing && mode.id !== 'competitive';
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setActiveMode(mode.id)}
                      disabled={disabled}
                      className={cn(
                        'px-4 md:px-6 py-3 rounded-t-md border-b-2 text-[10px] md:text-xs font-semibold tracking-[0.18em] uppercase whitespace-nowrap transition-all',
                        isActive
                          ? 'text-accent border-accent bg-accent/10'
                          : 'text-lobby-text-muted border-transparent hover:text-lobby-text hover:border-lobby-text-muted/40',
                        disabled && 'opacity-40 cursor-not-allowed',
                      )}
                    >
                      {mode.title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative z-10 flex-1 flex items-center justify-center px-4 md:px-10 pb-10">
            <div className="w-full max-w-6xl grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
              <div className="hidden md:block h-[320px] rounded-xl border border-lobby-text-muted/15 bg-lobby-text-muted/[0.03]" />

              <motion.div
                key={activeMode}
                className="w-full md:w-[360px] flex flex-col items-center"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              >
                <div className="w-full max-w-[320px] rounded-2xl border border-lobby-text-muted/25 bg-lobby-bg/75 backdrop-blur-sm p-3 shadow-[0_20px_70px_hsl(var(--background)/0.5)]">
                  <div className="h-[420px] rounded-xl border border-lobby-text-muted/20 bg-gradient-to-b from-lobby-text-muted/[0.10] to-lobby-text-muted/[0.03] relative overflow-hidden">
                    <div className="absolute inset-3 rounded-lg border border-lobby-text-muted/15 bg-lobby-bg/35 flex flex-col items-center justify-center">
                      <div className="w-24 h-24 rounded-2xl bg-lobby-bg/70 border border-lobby-text-muted/30 flex items-center justify-center">
                        <UserCircle2 className="w-14 h-14 text-lobby-text-muted" />
                      </div>
                      <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-lobby-text-muted/70">
                        Banner Placeholder
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center mt-5 max-w-[420px]">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-accent">{active.subtitle}</div>
                  <h2 className="mt-1 text-2xl md:text-3xl font-bold tracking-[0.08em] uppercase text-lobby-text">
                    {active.title}
                  </h2>
                  <div className="mt-1 text-xs text-lobby-text-muted">
                    {username ?? 'Player'} {rating != null ? `• MMR ${rating}` : '• Unranked'}
                  </div>
                  <p className="mt-2 text-sm text-lobby-text-muted leading-relaxed min-h-[56px]">
                    {active.description}
                  </p>
                </div>

                <div className="mt-4 w-full max-w-[420px] space-y-2">
                  <button
                    onClick={handlePrimaryAction}
                    className={cn(
                      'w-full h-12 rounded-lg font-bold tracking-[0.18em] uppercase text-sm transition-all px-4',
                      'inline-flex items-center justify-center relative',
                      isCompetitiveMode
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_22px_hsl(var(--primary)/0.32)]'
                        : 'bg-lobby-text text-lobby-bg hover:brightness-110',
                      isCompetitiveInQueue && 'ring-2 ring-primary/50',
                      'active:scale-[0.99]',
                    )}
                    aria-label={isCompetitiveInQueue ? 'Exit queue' : undefined}
                    title={isCompetitiveInQueue ? 'Click anywhere on this button to stop queue' : undefined}
                  >
                    {isCompetitiveMode ? (
                      <span className="w-full text-center">
                        {primaryLabel}
                        <X
                          className={cn(
                            'w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 transition-opacity pointer-events-none',
                            isCompetitiveInQueue ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                      </span>
                    ) : (
                      <span>{primaryLabel}</span>
                    )}
                  </button>

                  {isCompetitiveInQueue && (
                    <div className="text-center text-xs font-mono text-lobby-text-muted tracking-[0.08em]">
                      {formatTime(competitiveQueueTime)}
                    </div>
                  )}

                  {activeMode === 'competitive' && !isAuthenticated && (
                    <p className="text-center text-xs text-lobby-text-muted">
                      Sign in required for competitive queue.
                    </p>
                  )}
                </div>
              </motion.div>

              <div className="hidden md:block h-[320px] rounded-xl border border-lobby-text-muted/15 bg-lobby-text-muted/[0.03]" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
