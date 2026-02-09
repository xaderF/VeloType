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

interface UseGameStateProps {
  initialRating?: number;
  username?: string;
}

export interface PracticeSettings {
  punctuation: boolean;
  timeLimitSeconds: 15 | 30 | 60 | 120;
}

export function useGameState({
  initialRating = 1100,
  username = 'Player',
}: UseGameStateProps = {}) {
  const [phase, setPhase] = useState<GamePhase>('home');
  const [queueTime, setQueueTime] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [roundStats, setRoundStats] = useState<RoundStats | null>(null);
  const [playerRating, setPlayerRating] = useState(initialRating);
  const [drawOffered, setDrawOffered] = useState(false);
  const [drawAccepted, setDrawAccepted] = useState(false);
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

    setPhase('queue');
    setQueueTime(0);
    
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
      const opponentRating = playerRating + Math.floor((Math.random() - 0.5) * 200);
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
        maxRounds: 15,
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
    queueTimerRef.current = null;
    queueMatchTimerRef.current = null;
    matchFoundTimerRef.current = null;
    setPhase('home');
    setQueueTime(0);
  }, []);

  // Handle countdown
  useEffect(() => {
    if (phase !== 'countdown') return;

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
    let damageDealt = 0;
    let damageTaken = 0;
    
    if (playerScore > opponentScore) {
      winner = 'player';
      damageDealt = damageFromScores(playerScore, opponentScore);
    } else if (opponentScore > playerScore) {
      winner = 'opponent';
      damageTaken = damageFromScores(opponentScore, playerScore);
    }

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
    
    // Check for match end
    const roundResults = [...match.roundResults, roundResult];
    const maxRounds = match.maxRounds || 15;
    const tieAvailable = roundResults.length >= 10;

    const matchEnded =
      newPlayerHp <= 0 ||
      newOpponentHp <= 0 ||
      roundResults.length >= maxRounds ||
      (tieAvailable && drawAccepted);

    let matchWinner: 'player' | 'opponent' | 'draw' | null = null;
    if (newPlayerHp <= 0) matchWinner = 'opponent';
    else if (newOpponentHp <= 0) matchWinner = 'player';
    else if (roundResults.length >= maxRounds) {
      if (newPlayerHp > newOpponentHp) matchWinner = 'player';
      else if (newOpponentHp > newPlayerHp) matchWinner = 'opponent';
      else matchWinner = 'draw';
    } else if (tieAvailable && drawAccepted) {
      matchWinner = 'draw';
    }

    setMatch((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        player: { ...prev.player, hp: newPlayerHp },
        opponent: { ...prev.opponent, hp: newOpponentHp },
        currentRound: matchEnded ? prev.currentRound : prev.currentRound + 1,
        roundResults,
        status: matchEnded ? 'match_end' : 'round_end',
        winner: matchWinner,
      };
    });

    setPhase('round_end');
    if (resultsTimerRef.current) clearTimeout(resultsTimerRef.current);
    if (roundAdvanceTimerRef.current) clearTimeout(roundAdvanceTimerRef.current);

    // If match ended, calculate ELO and go to results
    if (matchEnded) {
      resultsTimerRef.current = setTimeout(() => {
        if (matchWinner !== null) {
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
      const breakMs = 7000;
      roundAdvanceTimerRef.current = setTimeout(() => {
        setPhase('countdown');
        setCountdown(3);
        roundAdvanceTimerRef.current = null;
      }, breakMs);
    }
  }, [match, playerRating, simulateOpponentStats, drawAccepted]);

  // Offer draw after round 10; simulate opponent acceptance
  const offerDraw = useCallback(() => {
    if (!match || match.currentRound < 10 || match.status === 'match_end') return;
    setDrawOffered(true);
    if (drawConfirmTimerRef.current) clearTimeout(drawConfirmTimerRef.current);
    if (drawResolveTimerRef.current) clearTimeout(drawResolveTimerRef.current);

    // Simulate opponent confirming draw shortly after
    drawConfirmTimerRef.current = setTimeout(() => {
      setDrawAccepted(true);
      setMatch((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'match_end',
          winner: 'draw',
        };
      });
      setPhase('round_end');
      drawResolveTimerRef.current = setTimeout(() => {
        const eloChange = calculateEloChange(
          playerRating,
          match.opponent.rating,
          'draw'
        );
        setPlayerRating((prev) => prev + eloChange);
        setPhase('results');
        drawResolveTimerRef.current = null;
      }, 2000);
      drawConfirmTimerRef.current = null;
    }, 800);
  }, [match, playerRating]);

  // Get current round text
  const getCurrentText = useCallback((): string => {
    if (!match) return '';
    return getSeededText(`${match.textSeed}-${match.currentRound}`, {
      length: Math.max(200, match.roundTimeSeconds * 8),
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
    queueTimerRef.current = null;
    queueMatchTimerRef.current = null;
    matchFoundTimerRef.current = null;
    countdownTimerRef.current = null;
    roundAdvanceTimerRef.current = null;
    resultsTimerRef.current = null;
    drawConfirmTimerRef.current = null;
    drawResolveTimerRef.current = null;

    setMatch(null);
    setRoundStats(null);
    setPhase('home');
    setQueueTime(0);
    setCountdown(3);
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
    };
  }, []);

  // Calculate ELO change for display
  const getEloChange = useCallback(() => {
    if (!match || !match.winner) return 0;
    const result: 'win' | 'loss' | 'draw' = match.winner === 'draw' ? 'draw' : match.winner === 'player' ? 'win' : 'loss';
    return calculateEloChange(playerRating, match.opponent.rating, result);
  }, [match, playerRating]);

  return {
    phase,
    queueTime,
    countdown,
    match,
    player,
    playerRating,
    roundStats,
    startQueue,
    cancelQueue,
    handleRoundComplete,
    offerDraw,
    getCurrentText,
    playAgain,
    getEloChange,
    drawOffered,
    drawAccepted,
    practiceSettings,
    updatePracticeSettings,
  };
}
