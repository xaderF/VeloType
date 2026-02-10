import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MatchHUD } from '@/components/game-ui/MatchHUD';
import { TypingArena } from '@/components/game-ui/TypingArena';
import { TypingOptionsBar } from '@/components/game-ui/TypingOptionsBar';
import { LetterParticles } from '@/components/game-ui/LetterParticles';
import { ForfeitConfirmDialog } from '@/components/game-ui/ForfeitConfirmDialog';
import { MatchState } from '@/types/game';
import { RoundStats } from '@/utils/scoring';
import { cn } from '@/lib/utils';

interface PlayScreenProps {
  match: MatchState;
  timeRemaining: number;
  currentText: string;
  onRoundComplete: (stats: RoundStats) => void;
  onRoundCompleteRaw?: (typed: string, samples: number[], totalErrors: number, totalKeystrokes: number) => void;
  onProgressUpdate?: (typed: string, cursor: number, errors: number, startedAtMs: number | null) => void;
  playerDamage?: number;
  opponentDamage?: number;
  punctuationEnabled: boolean;
  /** Whether the typing arena should be active (false during countdown/round_end) */
  isTypingActive?: boolean;
  /** Called when player forfeits */
  onForfeit?: () => void;
  /** If true, show a confirmation dialog before forfeiting */
  confirmForfeit?: boolean;
  /** Keep appending text as the cursor approaches the end. */
  infiniteText?: boolean;
}

export function PlayScreen({
  match,
  timeRemaining,
  currentText,
  onRoundComplete,
  onRoundCompleteRaw,
  onProgressUpdate,
  playerDamage,
  opponentDamage,
  punctuationEnabled,
  isTypingActive = true,
  onForfeit,
  confirmForfeit = false,
  infiniteText = false,
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
    <div className="min-h-screen flex flex-col p-4 md:p-8 bg-lobby-bg relative overflow-hidden">
      <LetterParticles />
      <div
        className={cn(
          'absolute inset-0 pointer-events-none transition-all duration-300',
          isTypingActive
            ? 'bg-lobby-bg/65 backdrop-blur-2xl'
            : 'bg-lobby-bg/45 backdrop-blur-[2px]',
        )}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-lobby-bg/40 pointer-events-none" />

      {/* Forfeit button — top left */}
      {onForfeit && (
        <motion.button
          onClick={handleForfeitClick}
          className="absolute top-4 left-4 z-30 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          ✕ Forfeit
        </motion.button>
      )}

      <ForfeitConfirmDialog
        isOpen={showForfeitDialog}
        onCancel={() => setShowForfeitDialog(false)}
        onConfirm={() => {
          setShowForfeitDialog(false);
          onForfeit?.();
        }}
      />

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
            onCompleteRaw={onRoundCompleteRaw}
            onProgressUpdate={onProgressUpdate}
            focusMode={isTypingActive}
            startOnFirstKeystroke={false}
            infiniteText={infiniteText}
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
