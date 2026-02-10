// RoundEndOverlay: Overlay shown at the end of a round. Used in TypingArena.
// Depends on: framer-motion, RoundResultCard, RoundResult, cn util.
// Props: isVisible, roundResult, onContinue, drawAvailable.
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RoundResultCard } from '@/components/game-ui/ResultCards';
import { WpmChart } from '@/components/game-ui/WpmChart';
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
  drawVoteSelection?: 'draw' | 'continue' | null;
  onVoteDraw?: () => void;
  onVoteContinue?: () => void;
  breakSeconds?: number;
  playerName?: string;
  opponentName?: string;
  playerHp?: number;
  opponentHp?: number;
  maxHp?: number;
}

export function RoundEndOverlay({
  isVisible,
  roundResult,
  onContinue,
  drawAvailable = false,
  drawOffered = false,
  drawAccepted = false,
  onOfferDraw,
  drawVoteSelection = null,
  onVoteDraw,
  onVoteContinue,
  breakSeconds = 7,
  playerName = 'You',
  opponentName = 'Opponent',
  playerHp = 100,
  opponentHp = 100,
  maxHp = 100,
}: RoundEndOverlayProps) {
  const damageTaken = roundResult?.damageTaken ?? 0;
  const damageDealt = roundResult?.damageDealt ?? 0;
  const roundNumber = roundResult?.roundNumber ?? 0;

  const preRoundPlayerHp = useMemo(
    () => Math.max(0, Math.min(maxHp, playerHp + Math.max(0, damageTaken))),
    [playerHp, damageTaken, maxHp],
  );
  const preRoundOpponentHp = useMemo(
    () => Math.max(0, Math.min(maxHp, opponentHp + Math.max(0, damageDealt))),
    [opponentHp, damageDealt, maxHp],
  );

  const [displayHp, setDisplayHp] = useState({ player: playerHp, opponent: opponentHp });
  useEffect(() => {
    if (!isVisible) return;

    setDisplayHp({ player: preRoundPlayerHp, opponent: preRoundOpponentHp });
    const timer = setTimeout(() => {
      setDisplayHp({
        player: Math.max(0, Math.min(maxHp, playerHp)),
        opponent: Math.max(0, Math.min(maxHp, opponentHp)),
      });
    }, 220);

    return () => clearTimeout(timer);
  }, [isVisible, roundNumber, preRoundPlayerHp, preRoundOpponentHp, playerHp, opponentHp, maxHp]);

  const playerPercent = Math.max(0, Math.min(100, (displayHp.player / Math.max(1, maxHp)) * 100));
  const opponentPercent = Math.max(0, Math.min(100, (displayHp.opponent / Math.max(1, maxHp)) * 100));

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
            <motion.div
              className="mb-4 rounded-xl border border-border bg-card/70 p-4"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{playerName}</div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden border border-border/70">
                    <motion.div
                      className="h-full bg-gradient-to-r from-hp-full/80 to-hp-full"
                      initial={false}
                      animate={{ width: `${playerPercent}%` }}
                      transition={{ duration: 0.65, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">{Math.round(displayHp.player)} HP</div>
                </div>
                <div className="text-sm font-semibold text-muted-foreground">VS</div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground text-right">{opponentName}</div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden border border-border/70">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary/80 to-primary"
                      initial={false}
                      animate={{ width: `${opponentPercent}%` }}
                      transition={{ duration: 0.65, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="text-xs font-mono text-muted-foreground text-right">{Math.round(displayHp.opponent)} HP</div>
                </div>
              </div>
            </motion.div>

            <RoundResultCard
              roundNumber={roundResult.roundNumber}
              playerStats={roundResult.playerStats}
              opponentStats={roundResult.opponentStats}
              playerScore={roundResult.playerScore}
              opponentScore={roundResult.opponentScore}
              damageDealt={roundResult.damageDealt}
              damageTaken={roundResult.damageTaken}
              winner={roundResult.winner}
            />

            {drawAvailable && (
              <motion.div
                className="mt-4 w-full flex flex-col items-center gap-3 rounded-xl border border-primary/35 bg-primary/10 p-4"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="text-xs uppercase tracking-[0.16em] text-primary/90">Overtime Vote</div>
                <div className="text-2xl font-semibold text-foreground">Draw Match?</div>
                <div className="text-sm text-muted-foreground">Choose draw or continue.</div>
                <div className="flex items-center gap-2">
                  <button
                    className={cn(
                      'px-4 py-2 rounded-md border text-sm font-medium transition-colors',
                      drawVoteSelection === 'draw'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-accent hover:text-accent-foreground',
                    )}
                    disabled={drawAccepted || drawVoteSelection !== null}
                    onClick={onVoteDraw}
                  >
                    {drawVoteSelection === 'draw' ? 'Draw voted' : 'Draw'}
                  </button>
                  <button
                    className={cn(
                      'px-4 py-2 rounded-md border text-sm font-medium transition-colors',
                      drawVoteSelection === 'continue'
                        ? 'bg-secondary text-foreground border-border'
                        : 'hover:bg-accent hover:text-accent-foreground',
                    )}
                    disabled={drawAccepted || drawVoteSelection !== null}
                    onClick={onVoteContinue}
                  >
                    {drawVoteSelection === 'continue' ? 'Continue voted' : 'Continue'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* WPM Chart for this round */}
            {roundResult.playerStats.wpmHistory && roundResult.playerStats.wpmHistory.length > 1 && (
              <motion.div
                className="mt-4 rounded-xl border border-border bg-card/50 p-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <WpmChart data={roundResult.playerStats.wpmHistory} className="h-[160px]" />
              </motion.div>
            )}

            <motion.div
              className="text-center mt-6 text-muted-foreground space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <div>Break: next round auto-starts in {breakSeconds}s</div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
