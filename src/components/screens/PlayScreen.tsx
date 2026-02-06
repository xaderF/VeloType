import { motion } from 'framer-motion';
import { MatchHUD } from '@/components/game/MatchHUD';
import { TypingArena } from '@/components/game/TypingArena';
import { MatchState } from '@/types/game';
import { RoundStats } from '@/utils/scoring';

interface PlayScreenProps {
  match: MatchState;
  timeRemaining: number;
  currentText: string;
  onRoundComplete: (stats: RoundStats) => void;
  playerDamage?: number;
  opponentDamage?: number;
}

export function PlayScreen({
  match,
  timeRemaining,
  currentText,
  onRoundComplete,
  playerDamage,
  opponentDamage,
}: PlayScreenProps) {
  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 bg-grid-pattern relative">
      {/* Subtle background effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto w-full flex flex-col gap-8">
        {/* HUD */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
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

        {/* Phrase Type Selection */}
        <div className="mb-4 flex justify-center">
          <select className="px-3 py-2 rounded border bg-background text-foreground" style={{ minWidth: 180 }}>
            <option value="words">Words</option>
            <option value="quote">Quote</option>
            <option value="punctuation">Punctuation</option>
            <option value="numbers">Numbers</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        {/* Typing Arena */}
        <div className="flex-1 flex items-center">
          <TypingArena
            text={currentText}
            isActive={true}
            timeLimit={match.roundTimeSeconds}
            onComplete={onRoundComplete}
          />
        </div>

        {/* Round indicator */}
        <motion.div
          className="text-center text-muted-foreground text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Round {match.currentRound} of {match.maxRounds} • Type fast, type accurate
        </motion.div>
      </div>
    </div>
  );
}
