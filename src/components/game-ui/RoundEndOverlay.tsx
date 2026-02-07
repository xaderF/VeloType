// RoundEndOverlay: Overlay shown at the end of a round. Used in TypingArena.
// Depends on: framer-motion, RoundResultCard, RoundResult, cn util.
// Props: isVisible, roundResult, onContinue, drawAvailable.
import { motion, AnimatePresence } from 'framer-motion';
import { RoundResultCard } from '@/components/game/ResultCards';
import { RoundResult } from '@/types/game';
import { cn } from '@/lib/utils';

interface RoundEndOverlayProps {
  isVisible: boolean;
  roundResult: RoundResult | null;
  onContinue?: () => void;
  drawAvailable?: boolean;
  drawOffered?: boolean;
  drawAccepted?: boolean;
  onOfferDraw?: () => void;
  breakSeconds?: number;
}

export function RoundEndOverlay({
  isVisible,
  roundResult,
  onContinue,
  drawAvailable = false,
  drawOffered = false,
  drawAccepted = false,
  onOfferDraw,
  breakSeconds = 15,
}: RoundEndOverlayProps) {
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
              className="text-center mt-6 text-muted-foreground space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <div>Break: next round auto-starts in {breakSeconds}s</div>

              {drawAvailable && (
                <div className="flex flex-col items-center gap-3">
                  <div className="text-sm text-muted-foreground">
                    Overtime draw option unlocked (round 10+). Both players must confirm.
                  </div>
                  <button
                    className={cn(
                      "px-4 py-2 rounded-md border text-sm font-medium transition-colors",
                      drawAccepted
                        ? "bg-secondary text-foreground"
                        : drawOffered
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                    disabled={drawAccepted}
                    onClick={onOfferDraw}
                  >
                    {drawAccepted ? 'Draw confirmed' : drawOffered ? 'Waiting for opponent...' : 'Offer draw'}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
