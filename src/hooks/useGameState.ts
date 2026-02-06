import { useState, useCallback, useEffect, useRef } from 'react';
import { GamePhase, Player, RoundResult, MatchState } from '@/types/game';
import { RoundStats, calculateScore, calculateDamage, calculateEloChange, getRankFromRating } from '@/utils/scoring';
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
  
  const queueTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Create player object
  const player: Player = {
    id: '1',
    username,
    rating: playerRating,
    rank: getRankFromRating(playerRating).rank,
    hp: match?.player.hp ?? 100,
    maxHp: 100,
  };

  // Start queue
  const startQueue = useCallback(() => {
    setPhase('queue');
    setQueueTime(0);
    
    queueTimerRef.current = setInterval(() => {
      setQueueTime((prev) => prev + 1);
    }, 1000);

    // Simulate finding a match after 2-4 seconds
    const matchDelay = 2000 + Math.random() * 2000;
    setTimeout(() => {
      if (queueTimerRef.current) {
        clearInterval(queueTimerRef.current);
      }
      
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
        maxRounds: 3,
        roundResults: [],
        roundTimeSeconds: 30,
        status: 'waiting',
        winner: null,
        textSeed: seed,
      });

      setPhase('match_found');

      // Auto-start countdown after showing match found
      setTimeout(() => {
        setPhase('countdown');
        setCountdown(3);
      }, 2500);
    }, matchDelay);
  }, [playerRating, player]);

  // Cancel queue
  const cancelQueue = useCallback(() => {
    if (queueTimerRef.current) {
      clearInterval(queueTimerRef.current);
    }
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
    if (!match) {
      return { wpm: baseWpm, accuracy: 95, errors: 2, charactersTyped: 100, correctCharacters: 95 };
    }
    
    // Opponent performance based on rating difference
    const ratingFactor = match.opponent.rating / 1200;
    const wpm = Math.round(baseWpm * ratingFactor * (0.9 + Math.random() * 0.2));
    const accuracy = Math.min(99, Math.round(90 + Math.random() * 8));
    const errors = Math.max(0, Math.round((100 - accuracy) * 2));
    const chars = Math.round(wpm * 0.5 * 5); // 30 seconds worth
    
    return {
      wpm,
      accuracy,
      errors,
      charactersTyped: chars,
      correctCharacters: Math.round(chars * accuracy / 100),
    };
  }, [match]);

  // Handle round completion
  const handleRoundComplete = useCallback((playerStats: RoundStats) => {
    if (!match) return;

    setRoundStats(playerStats);
    
    // Simulate opponent stats
    const opponentStats = simulateOpponentStats(playerStats.wpm);
    
    // Calculate scores
    const playerScore = calculateScore(playerStats.wpm, playerStats.accuracy);
    const opponentScore = calculateScore(opponentStats.wpm, opponentStats.accuracy);
    
    // Determine winner and damage
    let winner: 'player' | 'opponent' | 'draw' = 'draw';
    let damageDealt = 0;
    let damageTaken = 0;
    
    if (playerScore > opponentScore) {
      winner = 'player';
      damageDealt = calculateDamage(playerScore, opponentScore);
    } else if (opponentScore > playerScore) {
      winner = 'opponent';
      damageTaken = calculateDamage(opponentScore, playerScore);
    }

    const roundResult: RoundResult = {
      roundNumber: match.currentRound,
      playerStats,
      opponentStats,
      winner,
      damageDealt,
      damageTaken,
    };

    // Update HP
    const newPlayerHp = Math.max(0, match.player.hp - damageTaken);
    const newOpponentHp = Math.max(0, match.opponent.hp - damageDealt);
    
    // Check for match end
    const roundResults = [...match.roundResults, roundResult];
    const playerWins = roundResults.filter(r => r.winner === 'player').length;
    const opponentWins = roundResults.filter(r => r.winner === 'opponent').length;
    
    const matchEnded = 
      newPlayerHp <= 0 || 
      newOpponentHp <= 0 || 
      playerWins >= 2 || 
      opponentWins >= 2 ||
      match.currentRound >= match.maxRounds;

    const matchWinner = 
      newPlayerHp <= 0 ? 'opponent' :
      newOpponentHp <= 0 ? 'player' :
      playerWins >= 2 ? 'player' :
      opponentWins >= 2 ? 'opponent' :
      playerWins > opponentWins ? 'player' :
      opponentWins > playerWins ? 'opponent' :
      null;

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

    // If match ended, calculate ELO and go to results
    if (matchEnded) {
      setTimeout(() => {
        if (matchWinner) {
          const eloChange = calculateEloChange(
            playerRating,
            match.opponent.rating,
            matchWinner === 'player'
          );
          setPlayerRating((prev) => prev + eloChange);
        }
        setPhase('results');
      }, 3000);
    } else {
      // Continue to next round after a delay
      setTimeout(() => {
        setPhase('countdown');
        setCountdown(3);
      }, 3000);
    }
  }, [match, playerRating, simulateOpponentStats]);

  // Get current round text
  const getCurrentText = useCallback((): string => {
    if (!match) return '';
    return getSeededText(match.textSeed + match.currentRound);
  }, [match]);

  // Play again
  const playAgain = useCallback(() => {
    setMatch(null);
    setRoundStats(null);
    setPhase('home');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (queueTimerRef.current) clearInterval(queueTimerRef.current);
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, []);

  // Calculate ELO change for display
  const getEloChange = useCallback(() => {
    if (!match || !match.winner) return 0;
    return calculateEloChange(
      playerRating - (match.winner === 'player' ? calculateEloChange(playerRating, match.opponent.rating, true) : calculateEloChange(playerRating, match.opponent.rating, false)),
      match.opponent.rating,
      match.winner === 'player'
    );
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
    getCurrentText,
    playAgain,
    getEloChange,
  };
}
