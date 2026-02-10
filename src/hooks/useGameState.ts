import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { GamePhase, Player, RoundResult, MatchState } from '@/types/game';
import { RoundStats, calculateEloChange, getRankFromRating } from '@/utils/scoring';
import { performanceScore, damageFromScores } from '@/game/match';
import { getSeededText, generateMatchSeed } from '@/utils/textSeed';

// Simulated opponent names
const OPPONENT_NAMES = [
  'SwiftTyper',
  'KeyboardNinja',
  'SpeedDemon',
  'TypeMaster',
  'FingerFury',
  'WordWarrior',
  'QuickKeys',
  'BlitzTyper',
];

const OVERTIME_TRIGGER_WINS = 3;
const REGULATION_ROUNDS = 6;
const ROUND_BREAK_SECONDS = 7;

interface UseGameStateProps {
  initialRating?: number;
  username?: string;
  allowRatingProgress?: boolean;
}

export interface PracticeSettings {
  punctuation: boolean;
  timeLimitSeconds: 15 | 30 | 60 | 120;
}

export function useGameState({
  initialRating = 1100,
  username = 'Player',
  allowRatingProgress = true,
}: UseGameStateProps = {}) {
  const [phase, setPhase] = useState<GamePhase>('home');
  const [queueTime, setQueueTime] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [roundStats, setRoundStats] = useState<RoundStats | null>(null);
  const [playerRating, setPlayerRating] = useState(initialRating);
  const [drawOffered, setDrawOffered] = useState(false);
  const [drawAccepted, setDrawAccepted] = useState(false);
  const [drawWindowOpen, setDrawWindowOpen] = useState(false);
  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings>({
    punctuation: false,
    timeLimitSeconds: 30,
  });
  
  const queueTimerRef = useRef<NodeJS.Timeout | null>(null);
  const queueMatchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const matchFoundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roundAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resultsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const drawConfirmTimerRef = useRef<NodeJS.Timeout | null>(null);
  const drawResolveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const breakCountdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const queueSessionRef = useRef(0);

  // Create player object (memoized to keep stable reference for hooks)
  const player: Player = useMemo(() => ({
    id: '1',
    username,
    rating: playerRating,
    rank: getRankFromRating(playerRating).rank,
    hp: match?.player.hp ?? 100,
    maxHp: 100,
  }), [match?.player.hp, playerRating, username]);

  // Start queue
  const startQueue = useCallback(() => {
    queueSessionRef.current += 1;
    const queueSession = queueSessionRef.current;

    if (queueTimerRef.current) clearInterval(queueTimerRef.current);
    if (queueMatchTimerRef.current) clearTimeout(queueMatchTimerRef.current);
    if (matchFoundTimerRef.current) clearTimeout(matchFoundTimerRef.current);
    if (breakCountdownTimerRef.current) clearInterval(breakCountdownTimerRef.current);

    setPhase('queue');
    setQueueTime(0);
    setBreakSeconds(0);
    
    queueTimerRef.current = setInterval(() => {
      setQueueTime((prev) => prev + 1);
    }, 1000);

    // Simulate finding a match after 2-4 seconds
    const matchDelay = 2000 + Math.random() * 2000;
    queueMatchTimerRef.current = setTimeout(() => {
      if (queueSessionRef.current !== queueSession) return;

      if (queueTimerRef.current) clearInterval(queueTimerRef.current);
      queueTimerRef.current = null;
      queueMatchTimerRef.current = null;
      
      // Generate opponent
      const opponentRating = Math.max(0, playerRating + Math.floor((Math.random() - 0.5) * 200));
      const opponent: Player = {
        id: '2',
        username: OPPONENT_NAMES[Math.floor(Math.random() * OPPONENT_NAMES.length)],
        rating: opponentRating,
        rank: getRankFromRating(opponentRating).rank,
        hp: 100,
        maxHp: 100,
      };

      const seed = generateMatchSeed();
      
      setMatch({
        id: `match_${Date.now()}`,
        player: { ...player, hp: 100, maxHp: 100 },
        opponent,
        currentRound: 1,
        maxRounds: 6,
        roundResults: [],
        roundTimeSeconds: practiceSettings.timeLimitSeconds,
        status: 'waiting',
        winner: null,
        textSeed: seed,
        textSettings: {
          punctuation: practiceSettings.punctuation,
        },
      });

      setDrawOffered(false);
      setDrawAccepted(false);
      setDrawWindowOpen(false);

      setPhase('match_found');

      // Auto-start countdown after showing match found
      matchFoundTimerRef.current = setTimeout(() => {
        if (queueSessionRef.current !== queueSession) return;
        setPhase('countdown');
        setCountdown(3);
        matchFoundTimerRef.current = null;
      }, 2500);
    }, matchDelay);
  }, [playerRating, player, practiceSettings]);

  // Cancel queue
  const cancelQueue = useCallback(() => {
    queueSessionRef.current += 1;
    if (queueTimerRef.current) clearInterval(queueTimerRef.current);
    if (queueMatchTimerRef.current) clearTimeout(queueMatchTimerRef.current);
    if (matchFoundTimerRef.current) clearTimeout(matchFoundTimerRef.current);
    if (breakCountdownTimerRef.current) clearInterval(breakCountdownTimerRef.current);
    queueTimerRef.current = null;
    queueMatchTimerRef.current = null;
    matchFoundTimerRef.current = null;
    breakCountdownTimerRef.current = null;
    setPhase('home');
    setQueueTime(0);
    setBreakSeconds(0);
    setDrawOffered(false);
    setDrawAccepted(false);
    setDrawWindowOpen(false);
  }, []);

  // Handle countdown
  useEffect(() => {
    if (phase !== 'countdown') return;
    setBreakSeconds(0);

    if (countdown > 0) {
      countdownTimerRef.current = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else {
      setPhase('playing');
    }

    return () => {
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
    };
  }, [phase, countdown]);

  // Simulate opponent stats (they perform based on their rating)
  const simulateOpponentStats = useCallback((baseWpm: number = 60): RoundStats => {
    const elapsedMinutes = match ? match.roundTimeSeconds / 60 : 0.5;
    const ratingFactor = match ? match.opponent.rating / 1200 : 1;

    const wpm = Math.max(20, Math.round(baseWpm * ratingFactor * (0.9 + Math.random() * 0.2)));
    const accuracy = Math.min(0.99, Math.max(0.8, 0.9 + (Math.random() - 0.5) * 0.1));
    const consistency = Math.min(1, Math.max(0, 0.75 + (Math.random() - 0.5) * 0.15));
    const correctCharacters = Math.round(wpm * 5 * elapsedMinutes);
    const charactersTyped = Math.max(correctCharacters, Math.round(correctCharacters / Math.max(accuracy, 0.0001)));
    const errors = Math.max(0, charactersTyped - correctCharacters);
    const rawWpm = (charactersTyped / 5) / elapsedMinutes;

    return {
      wpm,
      rawWpm,
      accuracy,
      consistency,
      errors,
      totalErrors: errors,
      charactersTyped,
      correctCharacters,
    };
  }, [match]);

  // Handle round completion
  const handleRoundComplete = useCallback((playerStats: RoundStats) => {
    if (!match) return;

    setRoundStats(playerStats);
    
    // Simulate opponent stats
    const opponentStats = simulateOpponentStats(playerStats.wpm);
    
    // Calculate scores
    const playerScore = performanceScore(playerStats, match.player.rating);
    const opponentScore = performanceScore(opponentStats, match.opponent.rating);
    
    // Determine winner and damage
    let winner: 'player' | 'opponent' | 'draw' = 'draw';
    let rawDamageDealt = 0;
    let rawDamageTaken = 0;
    
    if (playerScore > opponentScore) {
      winner = 'player';
      rawDamageDealt = damageFromScores(playerScore, opponentScore);
    } else if (opponentScore > playerScore) {
      winner = 'opponent';
      rawDamageTaken = damageFromScores(opponentScore, playerScore);
    }

    // Effective damage cannot exceed remaining HP.
    const damageDealt = Math.min(match.opponent.hp, rawDamageDealt);
    const damageTaken = Math.min(match.player.hp, rawDamageTaken);

    const roundResult: RoundResult = {
      roundNumber: match.currentRound,
      playerStats,
      opponentStats,
      playerScore,
      opponentScore,
      winner,
      damageDealt,
      damageTaken,
    };

    // Update HP
    const newPlayerHp = Math.max(0, match.player.hp - damageTaken);
    const newOpponentHp = Math.max(0, match.opponent.hp - damageDealt);
    
    // Match end is HP-based only. Round wins are used for overtime/draw flow.
    const roundResults = [...match.roundResults, roundResult];
    const playerWins = roundResults.filter((r) => r.winner === 'player').length;
    const opponentWins = roundResults.filter((r) => r.winner === 'opponent').length;

    const playerKnockedOut = newPlayerHp <= 0;
    const opponentKnockedOut = newOpponentHp <= 0;
    const matchEnded = playerKnockedOut || opponentKnockedOut;

    let matchWinner: 'player' | 'opponent' | 'draw' | null = null;
    if (matchEnded) {
      if (playerKnockedOut && !opponentKnockedOut) {
        matchWinner = 'opponent';
      } else if (opponentKnockedOut && !playerKnockedOut) {
        matchWinner = 'player';
      } else {
        matchWinner = winner;
      }
    }

    const overtimeActive =
      (playerWins >= OVERTIME_TRIGGER_WINS && opponentWins >= OVERTIME_TRIGGER_WINS) ||
      roundResults.length >= REGULATION_ROUNDS;
    const nextDrawWindowOpen =
      !matchEnded &&
      overtimeActive &&
      roundResults.length > REGULATION_ROUNDS &&
      (roundResults.length - REGULATION_ROUNDS) % 2 === 0;

    setDrawWindowOpen(nextDrawWindowOpen);
    if (!nextDrawWindowOpen) {
      setDrawOffered(false);
      setDrawAccepted(false);
    }

    setMatch((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        player: { ...prev.player, hp: newPlayerHp },
        opponent: { ...prev.opponent, hp: newOpponentHp },
        currentRound: matchEnded ? prev.currentRound : prev.currentRound + 1,
        maxRounds: Math.max(6, matchEnded ? prev.currentRound : prev.currentRound + 1),
        roundResults,
        status: matchEnded ? 'match_end' : 'round_end',
        winner: matchWinner,
      };
    });

    setPhase('round_end');
    if (resultsTimerRef.current) clearTimeout(resultsTimerRef.current);
    if (roundAdvanceTimerRef.current) clearTimeout(roundAdvanceTimerRef.current);
    if (breakCountdownTimerRef.current) clearInterval(breakCountdownTimerRef.current);
    breakCountdownTimerRef.current = null;

    // If match ended, calculate ELO and go to results
    if (matchEnded) {
      setBreakSeconds(0);
      resultsTimerRef.current = setTimeout(() => {
        if (matchWinner !== null && allowRatingProgress) {
          const result: 'win' | 'loss' | 'draw' = matchWinner === 'draw' ? 'draw' : matchWinner === 'player' ? 'win' : 'loss';
          const eloChange = calculateEloChange(
            playerRating,
            match.opponent.rating,
            result
          );
          setPlayerRating((prev) => prev + eloChange);
        }
        setPhase('results');
        resultsTimerRef.current = null;
      }, 3000);
    } else {
      // 7s break between rounds, then normal countdown
      const breakMs = ROUND_BREAK_SECONDS * 1000;
      const breakEndsAt = Date.now() + breakMs;
      setBreakSeconds(ROUND_BREAK_SECONDS);
      breakCountdownTimerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((breakEndsAt - Date.now()) / 1000));
        setBreakSeconds(remaining);
        if (remaining <= 0 && breakCountdownTimerRef.current) {
          clearInterval(breakCountdownTimerRef.current);
          breakCountdownTimerRef.current = null;
        }
      }, 150);
      roundAdvanceTimerRef.current = setTimeout(() => {
        if (breakCountdownTimerRef.current) {
          clearInterval(breakCountdownTimerRef.current);
          breakCountdownTimerRef.current = null;
        }
        setBreakSeconds(0);
        setPhase('countdown');
        setCountdown(3);
        roundAdvanceTimerRef.current = null;
      }, breakMs);
    }
  }, [allowRatingProgress, match, playerRating, simulateOpponentStats]);

  // Overtime draw vote — available every 2 tied overtime rounds.
  const offerDraw = useCallback(() => {
    if (!match || !drawWindowOpen || match.status === 'match_end') return;
    setDrawOffered(true);
    if (drawConfirmTimerRef.current) clearTimeout(drawConfirmTimerRef.current);
    if (drawResolveTimerRef.current) clearTimeout(drawResolveTimerRef.current);

    // Simulate opponent vote shortly after: sometimes accepts, sometimes continues.
    drawConfirmTimerRef.current = setTimeout(() => {
      const opponentAcceptsDraw = Math.random() < 0.5;
      if (!opponentAcceptsDraw) {
        setDrawOffered(false);
        setDrawAccepted(false);
        setDrawWindowOpen(false);
        drawConfirmTimerRef.current = null;
        return;
      }

      setDrawAccepted(true);
      setDrawWindowOpen(false);
      if (roundAdvanceTimerRef.current) {
        clearTimeout(roundAdvanceTimerRef.current);
        roundAdvanceTimerRef.current = null;
      }
      if (breakCountdownTimerRef.current) {
        clearInterval(breakCountdownTimerRef.current);
        breakCountdownTimerRef.current = null;
      }
      setBreakSeconds(0);

      setMatch((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'match_end',
          winner: 'draw',
        };
      });

      drawResolveTimerRef.current = setTimeout(() => {
        if (allowRatingProgress) {
          const eloChange = calculateEloChange(playerRating, match.opponent.rating, 'draw');
          setPlayerRating((prev) => prev + eloChange);
        }
        setPhase('results');
        drawResolveTimerRef.current = null;
      }, 1200);
      drawConfirmTimerRef.current = null;
    }, 800);
  }, [allowRatingProgress, drawWindowOpen, match, playerRating]);

  const continueAfterDrawPrompt = useCallback(() => {
    if (!drawWindowOpen) return;
    setDrawOffered(false);
    setDrawAccepted(false);
    setDrawWindowOpen(false);
  }, [drawWindowOpen]);

  // Get current round text
  const getCurrentText = useCallback((): string => {
    if (!match) return '';
    const targetLength = Math.max(1200, Math.min(9000, match.roundTimeSeconds * 40));
    return getSeededText(`${match.textSeed}-${match.currentRound}`, {
      length: targetLength,
      difficulty: 'medium',
      includePunctuation: match.textSettings.punctuation,
    });
  }, [match]);

  const updatePracticeSettings = useCallback((next: Partial<PracticeSettings>) => {
    setPracticeSettings((prev) => {
      const time = next.timeLimitSeconds ?? prev.timeLimitSeconds;
      const safeTime = [15, 30, 60, 120].includes(time) ? time : prev.timeLimitSeconds;
      return {
        punctuation: next.punctuation ?? prev.punctuation,
        timeLimitSeconds: safeTime as PracticeSettings['timeLimitSeconds'],
      };
    });
  }, []);

  // Play again
  const playAgain = useCallback(() => {
    queueSessionRef.current += 1;
    if (queueTimerRef.current) clearInterval(queueTimerRef.current);
    if (queueMatchTimerRef.current) clearTimeout(queueMatchTimerRef.current);
    if (matchFoundTimerRef.current) clearTimeout(matchFoundTimerRef.current);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    if (roundAdvanceTimerRef.current) clearTimeout(roundAdvanceTimerRef.current);
    if (resultsTimerRef.current) clearTimeout(resultsTimerRef.current);
    if (drawConfirmTimerRef.current) clearTimeout(drawConfirmTimerRef.current);
    if (drawResolveTimerRef.current) clearTimeout(drawResolveTimerRef.current);
    if (breakCountdownTimerRef.current) clearInterval(breakCountdownTimerRef.current);
    queueTimerRef.current = null;
    queueMatchTimerRef.current = null;
    matchFoundTimerRef.current = null;
    countdownTimerRef.current = null;
    roundAdvanceTimerRef.current = null;
    resultsTimerRef.current = null;
    drawConfirmTimerRef.current = null;
    drawResolveTimerRef.current = null;
    breakCountdownTimerRef.current = null;

    setMatch(null);
    setRoundStats(null);
    setPhase('home');
    setQueueTime(0);
    setCountdown(3);
    setBreakSeconds(0);
    setDrawOffered(false);
    setDrawAccepted(false);
    setDrawWindowOpen(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (queueTimerRef.current) clearInterval(queueTimerRef.current);
      if (queueMatchTimerRef.current) clearTimeout(queueMatchTimerRef.current);
      if (matchFoundTimerRef.current) clearTimeout(matchFoundTimerRef.current);
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      if (roundAdvanceTimerRef.current) clearTimeout(roundAdvanceTimerRef.current);
      if (resultsTimerRef.current) clearTimeout(resultsTimerRef.current);
      if (drawConfirmTimerRef.current) clearTimeout(drawConfirmTimerRef.current);
      if (drawResolveTimerRef.current) clearTimeout(drawResolveTimerRef.current);
      if (breakCountdownTimerRef.current) clearInterval(breakCountdownTimerRef.current);
    };
  }, []);

  // Calculate ELO change for display
  const getEloChange = useCallback(() => {
    if (!allowRatingProgress) return 0;
    if (!match || !match.winner) return 0;
    const result: 'win' | 'loss' | 'draw' = match.winner === 'draw' ? 'draw' : match.winner === 'player' ? 'win' : 'loss';
    return calculateEloChange(playerRating, match.opponent.rating, result);
  }, [allowRatingProgress, match, playerRating]);

  return {
    phase,
    queueTime,
    countdown,
    breakSeconds,
    match,
    player,
    playerRating,
    roundStats,
    startQueue,
    cancelQueue,
    handleRoundComplete,
    offerDraw,
    continueAfterDrawPrompt,
    getCurrentText,
    playAgain,
    getEloChange,
    drawWindowOpen,
    drawOffered,
    drawAccepted,
    practiceSettings,
    updatePracticeSettings,
  };
}
