// HealthBar: Shows player health during the match. Used in MatchHUD.
// Depends on: framer-motion, cn util.
// Props: current, max, showDamage, isPlayer, className.
import { memo, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HealthBarProps {
  current: number;
  max: number;
  showDamage?: number;
  isPlayer?: boolean;
  className?: string;
}

export const HealthBar = memo(function HealthBar({ 
  current, 
  max, 
  showDamage, 
  isPlayer = true,
  className 
}: HealthBarProps) {
  const percentage = useMemo(() => {
    const safeMax = Math.max(1, max);
    return Math.max(0, Math.min(100, (current / safeMax) * 100));
  }, [current, max]);
  const [displayPercentage, setDisplayPercentage] = useState(percentage);
  const [damageTrail, setDamageTrail] = useState<{ id: number; from: number; to: number } | null>(null);

  useEffect(() => {
    setDamageTrail((prev) => {
      if (percentage < displayPercentage) {
        return { id: Date.now(), from: displayPercentage, to: percentage };
      }
      return prev;
    });
    setDisplayPercentage(percentage);
  }, [displayPercentage, percentage]);
  
  const getGradientClass = () => {
    if (displayPercentage > 60) return 'hp-gradient-full';
    if (displayPercentage > 30) return 'hp-gradient-mid';
    return 'hp-gradient-low';
  };

  return (
    <div
      className={cn("relative", className)}
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={isPlayer ? "Player health" : "Opponent health"}
    >
      {/* HP Label */}
      <div className={cn(
        "flex items-center gap-2 mb-1",
        isPlayer ? "justify-start" : "justify-end"
      )}>
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">HP</span>
        <span className="text-sm font-mono font-bold">
          {current}/{max}
        </span>
        {showDamage && showDamage > 0 && (
          <motion.span
            initial={{ opacity: 0, y: -10, scale: 1.5 }}
            animate={{ opacity: 0, y: -30, scale: 1 }}
            transition={{ duration: 1 }}
            className="text-damage font-bold text-glow-damage"
          >
            -{showDamage}
          </motion.span>
        )}
      </div>

      {/* HP Bar Container */}
      <div className="relative h-3 bg-secondary rounded-full overflow-hidden border border-border">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        
        {/* HP Fill */}
        <motion.div
          className={cn(
            "h-full rounded-full relative",
            getGradientClass()
          )}
          initial={false}
          animate={{ width: `${displayPercentage}%` }}
          transition={{ 
            duration: 0.45, 
            ease: "easeOut"
          }}
        >
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/20" />
        </motion.div>

        {damageTrail && damageTrail.from > damageTrail.to && (
          <motion.div
            key={damageTrail.id}
            className="absolute top-0 bottom-0 bg-damage/50"
            style={{ left: `${damageTrail.to}%` }}
            initial={{ width: `${damageTrail.from - damageTrail.to}%`, opacity: 0.75 }}
            animate={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            onAnimationComplete={() => {
              setDamageTrail((currentTrail) => (
                currentTrail?.id === damageTrail.id ? null : currentTrail
              ));
            }}
          />
        )}

        {/* Damage flash overlay */}
        {showDamage && showDamage > 0 && (
          <motion.div
            className="absolute inset-0 bg-damage/50"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </div>
    </div>
  );
});
