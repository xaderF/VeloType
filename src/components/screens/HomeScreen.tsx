import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { RankBadge } from '@/components/game-ui/RankBadge';
import { cn } from '@/lib/utils';

interface HomeScreenProps {
  username: string;
  rating: number | null;
  onPlayRanked: () => void;
}

export function HomeScreen({ username, rating, onPlayRanked }: HomeScreenProps) {
  const isGuest = !username || username === 'Player' || rating == null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">

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
            <span className="text-primary">Velo</span>
            <span className="text-foreground">Type</span>
          </h1>
          <p className="text-muted-foreground">
            Minimal, deterministic 1v1 typing duels
          </p>
        </motion.div>

        {/* Player Card */}
        <motion.div
          className="p-6 rounded-2xl border border-border bg-card/80 backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-3xl border-2 border-primary">
              👤
            </div>
            <div className="text-left">
              <div className="text-xl font-semibold">{isGuest ? 'Player' : username}</div>
              {isGuest ? (
                <span className="inline-block px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-sm font-semibold mt-1">Unranked</span>
              ) : (
                <RankBadge rating={rating} size="sm" />
              )}
            </div>
          </div>
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

        {/* Nav links */}
        {!isGuest && (
          <motion.div
            className="flex items-center justify-center gap-6 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <Link to="/profile" className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
              Profile & Stats
            </Link>
            <Link to="/history" className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
              Match History
            </Link>
            <Link to="/leaderboard" className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
              Leaderboard
            </Link>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
