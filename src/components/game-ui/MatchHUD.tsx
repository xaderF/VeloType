// MatchHUD: Main heads-up display for match info, health, and status. Uses HealthBar, RankBadge.
// Depends on: framer-motion, HealthBar, RankBadge, Player type, cn util.
// Props: player, opponent, currentRound.
import { memo } from 'react';
import { motion } from 'framer-motion';
import { HealthBar } from './HealthBar';
import { RankBadge } from './RankBadge';
import { Player } from '@/types/game';
import { cn } from '@/lib/utils';

interface MatchHUDProps {
  player: Player;
  opponent: Player;
  currentRound: number;
  maxRounds: number;
  timeRemaining: number;
  playerDamage?: number;
  opponentDamage?: number;
  className?: string;
}

export const MatchHUD = memo(function MatchHUD({
  player,
  opponent,
  currentRound,
  maxRounds,
  timeRemaining,
  playerDamage,
  opponentDamage,
  className,
}: MatchHUDProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Top bar with round and timer */}
      <div className="flex items-center justify-center gap-8 mb-6">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
            Round
          </div>
          <div className="text-3xl font-bold font-mono">
            {currentRound}/{maxRounds}
          </div>
        </motion.div>

        <motion.div
          className={cn(
            "text-center px-6 py-3 rounded-xl border",
            timeRemaining <= 10 
              ? "border-damage bg-damage/10 text-damage" 
              : "border-primary bg-primary/10 text-primary"
          )}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="text-xs uppercase tracking-widest mb-1">Time</div>
          <div className={cn(
            "text-4xl font-bold font-mono",
            timeRemaining <= 10 && "text-glow-damage"
          )}>
            {timeRemaining}
          </div>
        </motion.div>
      </div>

      {/* Player info bars */}
      <div className="grid grid-cols-2 gap-8">
        {/* Player side */}
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-3">
            <div className="text-xl font-semibold">{player.username}</div>
            <RankBadge rating={player.rating} size="sm" />
          </div>
          <HealthBar
            current={player.hp}
            max={player.maxHp}
            showDamage={playerDamage}
            isPlayer={true}
          />
        </motion.div>

        {/* Opponent side */}
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-end gap-3">
            <RankBadge rating={opponent.rating} size="sm" />
            <div className="text-xl font-semibold">{opponent.username}</div>
          </div>
          <HealthBar
            current={opponent.hp}
            max={opponent.maxHp}
            showDamage={opponentDamage}
            isPlayer={false}
          />
        </motion.div>
      </div>
    </div>
  );
});
