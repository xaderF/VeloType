import { motion, AnimatePresence } from 'framer-motion';
import { RoundResultCard } from '@/components/game/ResultCards';
import { RoundResult } from '@/types/game';
import { cn } from '@/lib/utils';

interface RoundEndOverlayProps {
  isVisible: boolean;
  roundResult: RoundResult | null;
  onContinue?: () => void;
}

export function RoundEndOverlay({ isVisible, roundResult, onContinue }: RoundEndOverlayProps) {
  if (!roundResult) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-lg"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <RoundResultCard
              roundNumber={roundResult.roundNumber}
              playerStats={roundResult.playerStats}
              opponentStats={roundResult.opponentStats}
              damageDealt={roundResult.damageDealt}
              damageTaken={roundResult.damageTaken}
              winner={roundResult.winner}
            />

            <motion.div
              className="text-center mt-6 text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              Next round starting soon...
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
