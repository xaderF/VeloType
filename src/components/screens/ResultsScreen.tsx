import { motion } from 'framer-motion';
import { MatchResults } from '@/components/game-ui/ResultCards';
import { RankBadge } from '@/components/game-ui/RankBadge';
import { MatchState } from '@/types/game';
import { RoundStats, getRankFromRating } from '@/utils/scoring';
import { cn } from '@/lib/utils';

interface ResultsScreenProps {
  match: MatchState;
  playerStats: RoundStats;
  opponentStats: RoundStats;
  eloChange: number;
  newRating: number;
  onBackToMenu: () => void;
}

export function ResultsScreen({
  match,
  playerStats,
  opponentStats,
  eloChange,
  newRating,
  onBackToMenu,
}: ResultsScreenProps) {
  const isWinner = match.winner === 'player';
  const oldRating = newRating - eloChange;
  const oldRank = getRankFromRating(oldRating);
  const newRank = getRankFromRating(newRating);
  const rankUp = newRank.rank !== oldRank.rank && newRating > oldRating;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-grid-pattern relative overflow-hidden">
      {/* Victory/Defeat background effect */}
      <motion.div
        className={cn(
          "absolute inset-0 opacity-10",
          isWinner 
            ? "bg-gradient-radial from-hp-full/30 via-transparent to-transparent"
            : "bg-gradient-radial from-damage/30 via-transparent to-transparent"
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.1 }}
      />

      <div className="relative z-10 max-w-2xl w-full space-y-8">
        {/* Match results */}
        <MatchResults
          playerStats={playerStats}
          opponentStats={opponentStats}
          playerHp={match.player.hp}
          opponentHp={match.opponent.hp}
          eloChange={eloChange}
          newRating={newRating}
          isWinner={isWinner}
        />

        {/* Rank up celebration */}
        {rankUp && (
          <motion.div
            className="text-center p-6 rounded-xl border-2 border-primary bg-primary/10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, type: "spring", bounce: 0.4 }}
          >
            <div className="text-2xl font-bold text-primary mb-4">
              🎉 RANK UP! 🎉
            </div>
            <div className="flex items-center justify-center gap-4">
              <RankBadge rating={oldRating} size="lg" />
              <span className="text-2xl">→</span>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1, type: "spring", bounce: 0.6 }}
              >
                <RankBadge rating={newRating} size="lg" />
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Round breakdown */}
        <motion.div
          className="p-4 rounded-xl border border-border bg-card/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Round Breakdown
          </h3>
          <div className="space-y-2">
            {match.roundResults.map((result, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-sm p-2 rounded-lg bg-secondary/50"
              >
                <span>Round {result.roundNumber}</span>
                <div className="flex items-center gap-4">
                  <span className="font-mono">{result.playerStats.wpm} WPM</span>
                  <span
                    className={cn(
                      "font-semibold px-2 py-0.5 rounded",
                      result.winner === 'player' && "bg-hp-full/20 text-hp-full",
                      result.winner === 'opponent' && "bg-damage/20 text-damage",
                      result.winner === 'draw' && "bg-muted text-muted-foreground"
                    )}
                  >
                    {result.winner === 'player' ? 'WIN' : result.winner === 'opponent' ? 'LOSS' : 'DRAW'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Back to menu button */}
        <motion.button
          onClick={onBackToMenu}
          className={cn(
            "w-full py-4 px-8 rounded-xl font-bold text-xl uppercase tracking-[0.08em]",
            "bg-primary text-primary-foreground",
            "hover:bg-primary/90 transition-all duration-300"
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          BACK TO MENU
        </motion.button>
      </div>
    </div>
  );
}
