import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MatchHUD } from '@/components/game-ui/MatchHUD';
import { TypingArena } from '@/components/game-ui/TypingArena';
import { TypingOptionsBar } from '@/components/game-ui/TypingOptionsBar';
import { MatchState } from '@/types/game';
import { RoundStats } from '@/utils/scoring';
import { cn } from '@/lib/utils';

interface PlayScreenProps {
  match: MatchState;
  timeRemaining: number;
  currentText: string;
  onRoundComplete: (stats: RoundStats) => void;
  playerDamage?: number;
  opponentDamage?: number;
  punctuationEnabled: boolean;
  /** Whether the typing arena should be active (false during countdown/round_end) */
  isTypingActive?: boolean;
  /** Called when player forfeits */
  onForfeit?: () => void;
  /** If true, show a confirmation dialog before forfeiting */
  confirmForfeit?: boolean;
}

export function PlayScreen({
  match,
  timeRemaining,
  currentText,
  onRoundComplete,
  playerDamage,
  opponentDamage,
  punctuationEnabled,
  isTypingActive = true,
  onForfeit,
  confirmForfeit = false,
}: PlayScreenProps) {
  const [showForfeitDialog, setShowForfeitDialog] = useState(false);

  const handleForfeitClick = () => {
    if (confirmForfeit) {
      setShowForfeitDialog(true);
    } else {
      onForfeit?.();
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 bg-grid-pattern relative">
      {/* Subtle background effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

      {/* Forfeit button — top left */}
      {onForfeit && (
        <motion.button
          onClick={handleForfeitClick}
          className="absolute top-4 left-4 z-20 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          ✕ Forfeit
        </motion.button>
      )}

      {/* Forfeit confirmation dialog */}
      <AnimatePresence>
        {showForfeitDialog && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm p-6 rounded-2xl border-2 border-destructive/50 bg-card shadow-2xl space-y-5"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.3 }}
            >
              <div className="text-center space-y-2">
                <div className="text-2xl font-bold text-destructive">Forfeit Match?</div>
                <div className="text-sm text-muted-foreground">
                  This will count as a loss and you'll lose rating points.
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowForfeitDialog(false)}
                  className="flex-1 py-3 rounded-xl border border-border bg-secondary text-foreground font-semibold hover:bg-secondary/80 transition-colors"
                >
                  Keep Playing
                </button>
                <button
                  onClick={() => {
                    setShowForfeitDialog(false);
                    onForfeit?.();
                  }}
                  className="flex-1 py-3 rounded-xl bg-destructive text-destructive-foreground font-semibold hover:bg-destructive/90 transition-colors"
                >
                  Forfeit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-4xl mx-auto w-full flex flex-col gap-8">
        {/* HUD — hidden during active typing for focus */}
        <AnimatePresence>
          {!isTypingActive && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <MatchHUD
                player={match.player}
                opponent={match.opponent}
                currentRound={match.currentRound}
                maxRounds={match.maxRounds}
                timeRemaining={timeRemaining}
                playerDamage={playerDamage}
                opponentDamage={opponentDamage}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!isTypingActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <TypingOptionsBar
                punctuationEnabled={punctuationEnabled}
                timeLimit={match.roundTimeSeconds}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Typing Arena */}
        <div className="flex-1 flex items-center">
          <TypingArena
            text={currentText}
            isActive={isTypingActive}
            timeLimit={match.roundTimeSeconds}
            onComplete={onRoundComplete}
            focusMode={isTypingActive}
            startOnFirstKeystroke={false}
          />
        </div>

        {/* Round indicator — hidden during active typing */}
        <AnimatePresence>
          {!isTypingActive && (
            <motion.div
              className="text-center text-muted-foreground text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.5 }}
            >
              Round {match.currentRound} of {match.maxRounds} • Type fast, type accurate
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
