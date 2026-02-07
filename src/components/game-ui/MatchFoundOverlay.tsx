// MatchFoundOverlay: Overlay shown when a match is found. Used in PlayScreen.
// Depends on: RankBadge, Player type, cn util.
// Props: isVisible, player, opponent, onReady.
import { motion, AnimatePresence } from 'framer-motion';
import { RankBadge } from './RankBadge';
import { Player } from '@/types/game';
import { cn } from '@/lib/utils';

interface MatchFoundOverlayProps {
  isVisible: boolean;
  player: Player;
  opponent: Player;
  onReady?: () => void;
  className?: string;
}

export function MatchFoundOverlay({
  isVisible,
  player,
  opponent,
  onReady,
  className,
}: MatchFoundOverlayProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md",
            className
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="w-full max-w-2xl px-4">
            {/* Title */}
            <motion.h2
              className="text-3xl font-bold text-center mb-12 text-primary text-glow-primary"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              MATCH FOUND
            </motion.h2>

            {/* VS Display */}
            <div className="flex items-center justify-between">
              {/* Player */}
              <motion.div
                className="text-center space-y-3"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, type: "spring" }}
              >
                <div className="w-24 h-24 mx-auto rounded-full bg-primary/20 flex items-center justify-center text-4xl border-2 border-primary glow-primary">
                  👤
                </div>
                <div className="font-semibold text-lg">{player.username}</div>
                <RankBadge rating={player.rating} showRating />
              </motion.div>

              {/* VS */}
              <motion.div
                className="text-4xl font-bold text-muted-foreground"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: "spring", bounce: 0.5 }}
              >
                VS
              </motion.div>

              {/* Opponent */}
              <motion.div
                className="text-center space-y-3"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, type: "spring" }}
              >
                <div className="w-24 h-24 mx-auto rounded-full bg-destructive/20 flex items-center justify-center text-4xl border-2 border-destructive">
                  👤
                </div>
                <div className="font-semibold text-lg">{opponent.username}</div>
                <RankBadge rating={opponent.rating} showRating />
              </motion.div>
            </div>

            {/* Ready hint */}
            <motion.div
              className="text-center mt-12 text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              Match starting soon...
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
