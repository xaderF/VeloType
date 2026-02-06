import { motion } from 'framer-motion';
import { RankBadge } from '@/components/game/RankBadge';
import { getProgressToNextRank, getRankFromRating, RANKS } from '@/utils/scoring';
import { cn } from '@/lib/utils';

interface HomeScreenProps {
  username: string;
  rating: number;
  onPlayRanked: () => void;
}

export function HomeScreen({ username, rating, onPlayRanked }: HomeScreenProps) {
  const rankInfo = getRankFromRating(rating);
  const progress = getProgressToNextRank(rating);
  const nextRankIndex = RANKS.findIndex(r => r.rank === rankInfo.rank) + 1;
  const nextRank = nextRankIndex < RANKS.length ? RANKS[nextRankIndex] : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-grid-pattern relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <motion.div
        className="relative z-10 text-center space-y-12 max-w-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Logo/Title */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-2">
            <span className="text-primary text-glow-primary">TYPE</span>
            <span className="text-foreground">ARENA</span>
          </h1>
          <p className="text-muted-foreground">
            Ranked 1v1 Typing Battles
          </p>
        </motion.div>

        {/* Player Card */}
        <motion.div
          className="p-6 rounded-2xl border border-border bg-card/80 backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-3xl border-2 border-primary">
              👤
            </div>
            <div className="text-left">
              <div className="text-xl font-semibold">{username}</div>
              <RankBadge rating={rating} showRating size="sm" />
            </div>
          </div>

          {/* Progress to next rank */}
          {nextRank && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{rankInfo.name}</span>
                <span>{nextRank.name}</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className={cn("h-full", rankInfo.color)}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                />
              </div>
              <div className="text-xs text-center text-muted-foreground">
                {nextRank.minRating - rating} points to {nextRank.name}
              </div>
            </div>
          )}
        </motion.div>

        {/* Play Button */}
        <motion.button
          onClick={onPlayRanked}
          className={cn(
            "w-full py-5 px-8 rounded-xl font-bold text-xl",
            "bg-primary text-primary-foreground",
            "glow-primary hover:glow-primary-intense",
            "transition-all duration-300",
            "border-2 border-primary/50"
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          ⚔️ PLAY RANKED
        </motion.button>

        {/* Stats hint */}
        <motion.p
          className="text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Best of 3 rounds • 30 seconds each • Winner takes ELO
        </motion.p>
      </motion.div>
    </div>
  );
}
