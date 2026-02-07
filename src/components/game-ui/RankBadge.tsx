// RankBadge: Displays player rank badge with tier (e.g. "Silver 3").
// Apex/Paragon show raw ELO. Unranked (null rating) shows nothing.
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getRankWithLeaderboard, getRankTierName, Rank } from '@/utils/scoring';

interface RankBadgeProps {
  rating: number | null | undefined;
  leaderboardPosition?: number | null;
  competitiveElo?: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const rankIcons: Record<Rank, string> = {
  iron: '⚔️',
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💎',
  diamond: '👑',
  velocity: '⚡',
  apex: '🔥',
  paragon: '🏆',
};

export function RankBadge({ rating, leaderboardPosition, competitiveElo, size = 'md', className }: RankBadgeProps) {
  if (rating == null) return null;

  const rankInfo = getRankWithLeaderboard(rating, leaderboardPosition);
  const tierName = getRankTierName(rating, leaderboardPosition, competitiveElo);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <motion.div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold text-primary-foreground',
        rankInfo.color,
        sizeClasses[size],
        className,
      )}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
    >
      <span>{rankIcons[rankInfo.rank]}</span>
      <span>{tierName}</span>
    </motion.div>
  );
}
