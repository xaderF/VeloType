import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, UserCircle2, X } from 'lucide-react';
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
  isBotQueueing: boolean;
  botQueueTime: number;
  onStartCompetitiveQueue: () => void;
  onCancelCompetitiveQueue: () => void;
  onStartBotQueue: () => void;
  onCancelBotQueue: () => void;
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
  isCompetitiveQueueing,
  competitiveQueueTime,
  isBotQueueing,
  botQueueTime,
  onStartCompetitiveQueue,
  onCancelCompetitiveQueue,
  onStartBotQueue,
  onCancelBotQueue,
  onStartFreeType,
  onBack,
  onLogin,
}: PlayModeSelectProps) {
  const [activeMode, setActiveMode] = useState<GameMode>('competitive');

  useEffect(() => {
    if (isCompetitiveQueueing) setActiveMode('competitive');
  }, [isCompetitiveQueueing]);

  useEffect(() => {
    if (isBotQueueing) setActiveMode('bot');
  }, [isBotQueueing]);

  const active = useMemo(() => MODES.find((m) => m.id === activeMode) ?? MODES[0], [activeMode]);
  const isCompetitiveMode = activeMode === 'competitive';
  const isBotMode = activeMode === 'bot';
  const isCompetitiveInQueue = isCompetitiveMode && isCompetitiveQueueing;
  const isBotInQueue = isBotMode && isBotQueueing;
  const isAnyQueueing = isCompetitiveQueueing || isBotQueueing;
  const showPartySlots = activeMode !== 'freetype';

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

    if (isBotMode) {
      if (isBotQueueing) {
        onCancelBotQueue();
        return;
      }
      onStartBotQueue();
      return;
    }

    onStartFreeType();
  };

  const primaryLabel = isCompetitiveInQueue || isBotInQueue ? 'IN QUEUE' : 'START';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col bg-lobby-bg overflow-y-auto overflow-x-hidden select-none"
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
                  const disabled = isAnyQueueing && mode.id !== activeMode;
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

          <div className="relative z-10 flex-1 flex items-start justify-center px-4 md:px-10 pt-6 md:pt-10 pb-14 md:pb-20">
            <div className="w-full max-w-6xl flex flex-col items-center">
              <div className="w-full flex items-end justify-center gap-4 lg:gap-6">
                {showPartySlots && (
                  <div className="hidden md:flex w-[clamp(220px,24vw,320px)] h-[clamp(360px,54vh,500px)] rounded-xl border border-lobby-text-muted/15 bg-lobby-text-muted/[0.03] items-center justify-center">
                    <button
                      type="button"
                      className="group flex flex-col items-center gap-3 text-lobby-text-muted/70 hover:text-lobby-text transition-colors"
                      aria-label="Invite teammate (coming soon)"
                      title="Party invites coming soon"
                    >
                      <span className="w-14 h-14 rounded-full border border-lobby-text-muted/35 bg-lobby-bg/45 flex items-center justify-center group-hover:border-lobby-text-muted/60 transition-colors">
                        <Plus className="w-6 h-6" />
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.2em]">Invite</span>
                    </button>
                  </div>
                )}

                <motion.div
                  className="w-full max-w-[clamp(220px,24vw,320px)] flex items-end justify-center"
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  <div className="w-full h-[clamp(360px,54vh,500px)] rounded-2xl border border-lobby-text-muted/25 bg-lobby-bg/75 backdrop-blur-sm p-3 shadow-[0_20px_70px_hsl(var(--background)/0.5)]">
                    <div className="h-full rounded-xl border border-lobby-text-muted/20 bg-gradient-to-b from-lobby-text-muted/[0.10] to-lobby-text-muted/[0.03] relative overflow-hidden">
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
                </motion.div>

                {showPartySlots && (
                  <div className="hidden md:flex w-[clamp(220px,24vw,320px)] h-[clamp(360px,54vh,500px)] rounded-xl border border-lobby-text-muted/15 bg-lobby-text-muted/[0.03] items-center justify-center">
                    <button
                      type="button"
                      className="group flex flex-col items-center gap-3 text-lobby-text-muted/70 hover:text-lobby-text transition-colors"
                      aria-label="Invite teammate (coming soon)"
                      title="Party invites coming soon"
                    >
                      <span className="w-14 h-14 rounded-full border border-lobby-text-muted/35 bg-lobby-bg/45 flex items-center justify-center group-hover:border-lobby-text-muted/60 transition-colors">
                        <Plus className="w-6 h-6" />
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.2em]">Invite</span>
                    </button>
                  </div>
                )}
              </div>

              <motion.div
                className="text-center mt-4 md:mt-6 w-full max-w-[clamp(220px,24vw,320px)]"
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.12 }}
              >
                <div className="text-[11px] uppercase tracking-[0.2em] text-accent">{active.subtitle}</div>
                <h2 className="mt-1 text-2xl md:text-3xl font-bold tracking-[0.08em] uppercase text-lobby-text">
                  {active.title}
                </h2>

                <div className="mt-4 w-full space-y-2">
                  <button
                    onClick={handlePrimaryAction}
                    className={cn(
                      'w-full h-12 rounded-lg font-bold tracking-[0.18em] uppercase text-sm transition-all px-4',
                      'inline-flex items-center justify-center relative',
                      'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_22px_hsl(var(--primary)/0.32)]',
                      (isCompetitiveInQueue || isBotInQueue) && 'ring-2 ring-primary/50',
                      'active:scale-[0.99]',
                    )}
                    aria-label={isCompetitiveInQueue || isBotInQueue ? 'Exit queue' : undefined}
                    title={isCompetitiveInQueue || isBotInQueue ? 'Click anywhere on this button to stop queue' : undefined}
                  >
                    <span className="w-full text-center">
                      {primaryLabel}
                      <X
                        className={cn(
                          'w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 transition-opacity pointer-events-none',
                          isCompetitiveInQueue || isBotInQueue ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </span>
                  </button>

                  {(isCompetitiveInQueue || isBotInQueue) && (
                    <div className="text-center text-xs font-mono text-lobby-text-muted tracking-[0.08em]">
                      {formatTime(isCompetitiveInQueue ? competitiveQueueTime : botQueueTime)}
                    </div>
                  )}

                  {activeMode === 'competitive' && !isAuthenticated && (
                    <p className="text-center text-xs text-lobby-text-muted">
                      Sign in required for competitive queue.
                    </p>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
