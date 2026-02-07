import { motion } from 'framer-motion';
import { MatchHUD } from '@/components/game-ui/MatchHUD';
import { TypingArena } from '@/components/game-ui/TypingArena';
import { TypingOptionsBar } from '@/components/game-ui/TypingOptionsBar';
import { MatchState } from '@/types/game';
import { RoundStats } from '@/utils/scoring';

interface PlayScreenProps {
  match: MatchState;
  timeRemaining: number;
  currentText: string;
  onRoundComplete: (stats: RoundStats) => void;
  playerDamage?: number;
  opponentDamage?: number;
  punctuationEnabled: boolean;
}

export function PlayScreen({
  match,
  timeRemaining,
  currentText,
  onRoundComplete,
  playerDamage,
  opponentDamage,
  punctuationEnabled,
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

        <TypingOptionsBar
          punctuationEnabled={punctuationEnabled}
          timeLimit={match.roundTimeSeconds}
        />

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
