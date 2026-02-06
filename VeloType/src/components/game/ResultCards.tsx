import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { RoundStats } from '@/utils/scoring';

interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  highlight?: boolean;
  delay?: number;
}

function StatCard({ label, value, suffix, highlight, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      className={cn(
        "p-4 rounded-xl border",
        highlight 
          ? "border-primary bg-primary/10" 
          : "border-border bg-card"
      )}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
    >
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={cn(
        "text-2xl font-bold font-mono",
        highlight && "text-primary text-glow-primary"
      )}>
        {value}
        {suffix && <span className="text-lg text-muted-foreground ml-1">{suffix}</span>}
      </div>
    </motion.div>
  );
}

interface RoundResultCardProps {
  roundNumber: number;
  playerStats: RoundStats;
  opponentStats: RoundStats;
  damageDealt: number;
  damageTaken: number;
  winner: 'player' | 'opponent' | 'draw';
  className?: string;
}

export function RoundResultCard({
  roundNumber,
  playerStats,
  opponentStats,
  damageDealt,
  damageTaken,
  winner,
  className,
}: RoundResultCardProps) {
  const isPlayerWinner = winner === 'player';
  const isOpponentWinner = winner === 'opponent';

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
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-2xl font-bold font-mono text-primary">
                {playerStats.wpm}
              </div>
              <div className="text-xs text-muted-foreground">WPM</div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono">
                {playerStats.accuracy}%
              </div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
            </div>
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
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-2xl font-bold font-mono text-primary">
                {opponentStats.wpm}
              </div>
              <div className="text-xs text-muted-foreground">WPM</div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono">
                {opponentStats.accuracy}%
              </div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
            </div>
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

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard 
          label="WPM" 
          value={playerStats.wpm} 
          highlight 
          delay={0.1} 
        />
        <StatCard 
          label="Accuracy" 
          value={playerStats.accuracy} 
          suffix="%" 
          delay={0.2} 
        />
        <StatCard 
          label="Errors" 
          value={playerStats.errors} 
          delay={0.3} 
        />
        <StatCard 
          label="Characters" 
          value={playerStats.charactersTyped} 
          delay={0.4} 
        />
      </div>

      {/* ELO change */}
      <motion.div
        className="text-center p-6 rounded-xl border border-border bg-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
          Rating Change
        </div>
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
      </motion.div>
    </motion.div>
  );
}
