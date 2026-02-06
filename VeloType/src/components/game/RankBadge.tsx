import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getRankFromRating, Rank } from '@/utils/scoring';

interface RankBadgeProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  showRating?: boolean;
  className?: string;
}

const rankIcons: Record<Rank, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💎',
  diamond: '👑',
};

export function RankBadge({ 
  rating, 
  size = 'md', 
  showRating = false,
  className 
}: RankBadgeProps) {
  const rankInfo = getRankFromRating(rating);
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <motion.div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold text-primary-foreground",
        rankInfo.color,
        sizeClasses[size],
        className
      )}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
    >
      <span>{rankIcons[rankInfo.rank]}</span>
      <span>{rankInfo.name}</span>
      {showRating && (
        <span className="text-primary-foreground/80 font-mono text-xs ml-1">
          {rating}
        </span>
      )}
    </motion.div>
  );
}
