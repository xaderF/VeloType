// PlayModeSelect — full-screen mode selection sub-screen (Valorant-style)
// Shows when the player clicks PLAY from the lobby.
// Three mode cards: Competitive, Versus Bot, Free Type.

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LetterParticles } from '@/components/game-ui/LetterParticles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GameMode = 'competitive' | 'bot' | 'freetype';

interface ModeCard {
  id: GameMode;
  title: string;
  subtitle: string;
  description: string;
  icon: string;        
  accent: string;
  authRequired?: boolean;
}

const MODES: ModeCard[] = [
  {
    id: 'competitive',
    title: 'COMPETITIVE',
    subtitle: 'Ranked Match',
    description: 'Queue into a live 1v1 against a real opponent. ELO rating on the line.',
    icon: '⚔️',
    accent: 'from-red-500/20 to-orange-500/10',
    authRequired: true,
  },
  {
    id: 'bot',
    title: 'VERSUS BOT',
    subtitle: 'Quick Match',
    description: 'Battle an AI opponent. Practice your combat typing without rating risk.',
    icon: '🤖',
    accent: 'from-blue-500/20 to-cyan-500/10',
  },
  {
    id: 'freetype',
    title: 'FREE TYPE',
    subtitle: 'Solo Practice',
    description: 'Pure typing practice. No opponents, no pressure — just you and the words.',
    icon: '⌨️',
    accent: 'from-emerald-500/20 to-teal-500/10',
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PlayModeSelectProps {
  isVisible: boolean;
  isAuthenticated: boolean;
  onSelectMode: (mode: GameMode) => void;
  onBack: () => void;
  onLogin: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlayModeSelect({
  isVisible,
  isAuthenticated,
  onSelectMode,
  onBack,
  onLogin,
}: PlayModeSelectProps) {
  const handleSelect = (mode: ModeCard) => {
    if (mode.authRequired && !isAuthenticated) {
      onLogin();
      return;
    }
    onSelectMode(mode.id);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col bg-lobby-bg overflow-hidden select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Shared background */}
          <LetterParticles />

          {/* Top bar with back button */}
          <motion.div
            className="relative z-10 flex items-center px-10 pt-8 pb-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-semibold tracking-widest uppercase text-lobby-text-muted hover:text-lobby-text transition-colors"
            >
              <span className="text-lg">←</span>
              BACK
            </button>
          </motion.div>

          {/* Title */}
          <motion.div
            className="relative z-10 text-center mb-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h1 className="text-3xl md:text-4xl font-bold tracking-[0.25em] uppercase text-lobby-text">
              SELECT <span className="text-accent">MODE</span>
            </h1>
            <p className="text-xs tracking-[0.3em] uppercase text-lobby-text-muted mt-2">
              Choose your game type
            </p>
          </motion.div>

          {/* Mode cards */}
          <div className="relative z-10 flex-1 flex items-center justify-center px-10 pb-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
              {MODES.map((mode, i) => {
                const locked = mode.authRequired && !isAuthenticated;

                return (
                  <motion.button
                    key={mode.id}
                    onClick={() => handleSelect(mode)}
                    className={cn(
                      'group relative flex flex-col items-center text-center p-8 rounded-2xl border transition-all duration-300',
                      'bg-gradient-to-b',
                      mode.accent,
                      locked
                        ? 'border-lobby-text-muted/10 opacity-60'
                        : 'border-lobby-text-muted/20 hover:border-accent/40 hover:shadow-[0_0_40px_hsl(var(--accent)/0.1)]',
                    )}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1, type: 'spring', bounce: 0.3 }}
                    whileHover={locked ? {} : { scale: 1.03, y: -4 }}
                    whileTap={locked ? {} : { scale: 0.98 }}
                  >
                    {/* Icon */}
                    <span className="text-4xl mb-4">{mode.icon}</span>

                    {/* Title */}
                    <h2 className="text-lg font-bold tracking-[0.2em] uppercase text-lobby-text mb-1">
                      {mode.title}
                    </h2>

                    {/* Subtitle */}
                    <p className="text-xs tracking-widest uppercase text-accent mb-4">
                      {mode.subtitle}
                    </p>

                    {/* Description */}
                    <p className="text-sm text-lobby-text-muted leading-relaxed max-w-[220px]">
                      {mode.description}
                    </p>

                    {/* Lock overlay */}
                    {locked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 rounded-2xl bg-lobby-bg/40 backdrop-blur-[1px]">
                        <svg
                          className="w-5 h-5 text-lobby-text-muted mb-1"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path d="M11 7V5a3 3 0 0 0-6 0v2H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1Zm-4-2a1 1 0 1 1 2 0v2H7V5Z" />
                        </svg>
                        <span className="text-xs text-lobby-text-muted tracking-widest uppercase">
                          Sign in to play
                        </span>
                      </div>
                    )}

                    {/* Bottom accent line on hover */}
                    <span
                      className={cn(
                        'absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-accent transition-all duration-300',
                        locked ? 'w-0' : 'w-0 group-hover:w-2/3',
                      )}
                    />
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
