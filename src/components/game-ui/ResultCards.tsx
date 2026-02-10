// ResultCards: Shows results after a match. Used in ResultsScreen.
// Depends on: framer-motion, cn util, RoundStats.
// Props: label, value, suffix, highlight, delay.
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { RoundStats } from '@/utils/scoring';
import { WpmChart } from './WpmChart';

/* ---------- small stat (secondary row) ---------- */

interface SmallStatProps {
  label: string;
  value: string | number;
  delay?: number;
}

function SmallStat({ label, value, delay = 0 }: SmallStatProps) {
  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
    >
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className="text-xl font-bold font-mono">{value}</div>
    </motion.div>
  );
}

interface RoundResultCardProps {
  roundNumber: number;
  playerStats: RoundStats;
  opponentStats: RoundStats;
  playerScore: number;
  opponentScore: number;
  damageDealt: number;
  damageTaken: number;
  winner: 'player' | 'opponent' | 'draw';
  className?: string;
}

export function RoundResultCard({
  roundNumber,
  playerStats,
  opponentStats,
  playerScore,
  opponentScore,
  damageDealt,
  damageTaken,
  winner,
  className,
}: RoundResultCardProps) {
  const isPlayerWinner = winner === 'player';
  const isOpponentWinner = winner === 'opponent';
  const scoreDelta = Math.round(playerScore - opponentScore);

  return (
    <motion.div
      className={cn("space-y-4", className)}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center">
        <h3 className="text-lg font-semibold text-muted-foreground">
          Round {roundNumber} Complete
        </h3>
        <motion.div
          className={cn(
            "text-2xl font-bold mt-2",
            isPlayerWinner && "text-hp-full",
            isOpponentWinner && "text-damage",
            winner === 'draw' && "text-muted-foreground"
          )}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
        >
          {isPlayerWinner && "You Won!"}
          {isOpponentWinner && "You Lost"}
          {winner === 'draw' && "Draw"}
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Player stats */}
        <div className={cn(
          "p-4 rounded-xl border",
          isPlayerWinner ? "border-hp-full bg-hp-full/10" : "border-border bg-card"
        )}>
          <div className="text-sm font-medium mb-3 text-center">You</div>
          <div className="text-center mb-1">
            <div className="text-4xl font-bold font-mono text-primary">
              {Math.round(playerStats.wpm)}
            </div>
            <div className="text-xs text-muted-foreground">wpm</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono">
              {Math.round(playerStats.accuracy * 100)}%
            </div>
            <div className="text-xs text-muted-foreground">acc</div>
          </div>
          {damageDealt > 0 && (
            <motion.div
              className="mt-3 text-center text-hp-full font-bold"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring" }}
            >
              -{damageDealt} damage dealt!
            </motion.div>
          )}
        </div>

        {/* Opponent stats */}
        <div className={cn(
          "p-4 rounded-xl border",
          isOpponentWinner ? "border-damage bg-damage/10" : "border-border bg-card"
        )}>
          <div className="text-sm font-medium mb-3 text-center">Opponent</div>
          <div className="text-center mb-1">
            <div className="text-4xl font-bold font-mono text-primary">
              {Math.round(opponentStats.wpm)}
            </div>
            <div className="text-xs text-muted-foreground">wpm</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono">
              {Math.round(opponentStats.accuracy * 100)}%
            </div>
            <div className="text-xs text-muted-foreground">acc</div>
          </div>
          {damageTaken > 0 && (
            <motion.div
              className="mt-3 text-center text-damage font-bold"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring" }}
            >
              -{damageTaken} damage taken
            </motion.div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/70 px-4 py-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Score</span>
          <span
            className={cn(
              "font-mono font-semibold",
              scoreDelta > 0 && "text-hp-full",
              scoreDelta < 0 && "text-damage",
              scoreDelta === 0 && "text-muted-foreground"
            )}
          >
            {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="text-xl font-bold font-mono text-foreground">{Math.round(playerScore)}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">vs</div>
          <div className="text-xl font-bold font-mono text-foreground">{Math.round(opponentScore)}</div>
        </div>
      </div>
    </motion.div>
  );
}

interface MatchResultsProps {
  playerStats: RoundStats;
  opponentStats: RoundStats;
  playerHp: number;
  opponentHp: number;
  eloChange: number;
  newRating: number;
  isWinner: boolean;
  isUnranked?: boolean;
  showRatingChange?: boolean;
  className?: string;
}

export function MatchResults({
  playerStats,
  opponentStats,
  playerHp,
  opponentHp,
  eloChange,
  newRating,
  isWinner,
  isUnranked = false,
  showRatingChange = true,
  className,
}: MatchResultsProps) {
  return (
    <motion.div
      className={cn("space-y-6", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Victory/Defeat banner */}
      <motion.div
        className={cn(
          "text-center py-8 rounded-2xl border-2",
          isWinner 
            ? "border-hp-full bg-hp-full/10" 
            : "border-damage bg-damage/10"
        )}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.4 }}
      >
        <motion.div
          className={cn(
            "text-5xl font-bold",
            isWinner ? "text-hp-full" : "text-damage"
          )}
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {isWinner ? "VICTORY" : "DEFEAT"}
        </motion.div>
        <motion.div
          className="text-muted-foreground mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Final HP: {playerHp} vs {opponentHp}
        </motion.div>
      </motion.div>

      {/* ── MonkeyType-style stats ── */}
      <motion.div
        className="p-6 rounded-2xl border border-border bg-card/60"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        {/* Hero stats: WPM + Accuracy */}
        <div className="flex items-end gap-10 mb-6">
          {/* WPM */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
            <div className="text-sm font-medium text-muted-foreground tracking-wider mb-1">
              wpm
            </div>
            <div className="text-7xl font-bold font-mono text-primary text-glow-primary leading-none">
              {Math.round(playerStats.wpm)}
            </div>
          </motion.div>

          {/* Accuracy */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.35 }}
          >
            <div className="text-sm font-medium text-muted-foreground tracking-wider mb-1">
              acc
            </div>
            <div className="text-7xl font-bold font-mono text-primary leading-none">
              {Math.round(playerStats.accuracy * 100)}
              <span className="text-4xl">%</span>
            </div>
          </motion.div>
        </div>

        {/* WPM Chart */}
        {playerStats.wpmHistory && playerStats.wpmHistory.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.3 }}
            className="pt-4"
          >
            <WpmChart data={playerStats.wpmHistory} className="h-[200px]" />
          </motion.div>
        )}

        {/* Secondary stats row */}
        <div className="flex items-center gap-8 pt-4 border-t border-border/50">
          <SmallStat
            label="raw"
            value={Math.round(playerStats.rawWpm)}
            delay={0.45}
          />
          <SmallStat
            label="characters"
            value={(() => {
              const corrected = (playerStats.totalErrors ?? 0) - playerStats.errors;
              return corrected > 0
                ? `${playerStats.correctCharacters}/${playerStats.errors}/${corrected}`
                : `${playerStats.correctCharacters}/${playerStats.errors}`;
            })()}
            delay={0.5}
          />
          <SmallStat
            label="consistency"
            value={`${Math.round(playerStats.consistency * 100)}%`}
            delay={0.55}
          />
          <SmallStat
            label="errors"
            value={playerStats.totalErrors ?? playerStats.errors}
            delay={0.6}
          />
        </div>
      </motion.div>

      {showRatingChange && (
        <motion.div
          className="text-center p-4 rounded-xl border border-border bg-card/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
        >
          <div className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
            {isUnranked ? 'Rank Status' : 'Rating Change'}
          </div>
          {isUnranked ? (
            <div className="space-y-1">
              <div className="text-2xl font-bold font-mono text-primary">UNRANKED</div>
              <div className="text-xs text-muted-foreground">Gold 1 baseline matchmaking for bot rounds</div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <span
                className={cn(
                  "text-3xl font-bold font-mono",
                  eloChange >= 0 ? "text-hp-full" : "text-damage"
                )}
              >
                {eloChange >= 0 ? '+' : ''}{eloChange}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="text-3xl font-bold font-mono text-primary">
                {newRating}
              </span>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
