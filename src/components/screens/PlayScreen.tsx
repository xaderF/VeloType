import { useState } from 'react';
import { motion } from 'framer-motion';
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
  /** Optional display override for player rank badge (e.g. null => UNRANKED badge). */
  playerRatingDisplay?: number | null;
  /** Optional display override for opponent rank badge (e.g. null => UNRANKED badge). */
  opponentRatingDisplay?: number | null;
  /** Show typing options bar above the arena. */
  showTypingOptions?: boolean;
  /** Optional authoritative overtime flag (online/server-driven). */
  overtimeActiveOverride?: boolean;
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
  playerRatingDisplay,
  opponentRatingDisplay,
  showTypingOptions = true,
  overtimeActiveOverride,
}: PlayScreenProps) {
  const [showForfeitDialog, setShowForfeitDialog] = useState(false);
  const resolvedPlayerRating = playerRatingDisplay === undefined ? match.player.rating : playerRatingDisplay;
  const resolvedOpponentRating = opponentRatingDisplay === undefined ? match.opponent.rating : opponentRatingDisplay;

  const playerWins = match.roundResults.filter((r) => r.winner === 'player').length;
  const opponentWins = match.roundResults.filter((r) => r.winner === 'opponent').length;
  const inferredOvertime = match.currentRound > 6 || (match.winner === null && playerWins >= 3 && opponentWins >= 3);
  const overtimeActive = Boolean(overtimeActiveOverride) || inferredOvertime;
  const overtimeRoundIndex = Math.max(1, match.currentRound - 6);
  const displayRound = overtimeActive ? ((overtimeRoundIndex - 1) % 2) + 1 : Math.min(match.currentRound, 6);
  const displayMaxRounds = overtimeActive ? 2 : 6;

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
          'bg-lobby-bg/45 backdrop-blur-[2px]',
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
        <MatchHUD
          player={{ ...match.player, rating: resolvedPlayerRating }}
          opponent={{ ...match.opponent, rating: resolvedOpponentRating }}
          currentRound={displayRound}
          maxRounds={displayMaxRounds}
          overtimeActive={overtimeActive}
          timeRemaining={timeRemaining}
          playerDamage={playerDamage}
          opponentDamage={opponentDamage}
        />

        {showTypingOptions && (
          <TypingOptionsBar
            punctuationEnabled={punctuationEnabled}
            timeLimit={match.roundTimeSeconds}
          />
        )}

        {/* Typing Arena */}
        <div className="flex-1 flex items-center">
          <TypingArena
            text={currentText}
            isActive={isTypingActive}
            timeLimit={match.roundTimeSeconds}
            onComplete={onRoundComplete}
            onCompleteRaw={onRoundCompleteRaw}
            onProgressUpdate={onProgressUpdate}
            startOnFirstKeystroke={false}
            infiniteText={infiniteText}
          />
        </div>

        <div className="text-center text-muted-foreground text-sm">
          {overtimeActive
            ? `Round ${displayRound}/${displayMaxRounds} • Overtime • Type fast, type accurate`
            : `Round ${displayRound}/${displayMaxRounds} • Type fast, type accurate`}
        </div>
      </div>
    </div>
  );
}
