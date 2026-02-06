import { useState, useEffect } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { PlayScreen } from '@/components/screens/PlayScreen';
import { ResultsScreen } from '@/components/screens/ResultsScreen';
import { QueueOverlay } from '@/components/game/QueueOverlay';
import { MatchFoundOverlay } from '@/components/game/MatchFoundOverlay';
import { CountdownOverlay } from '@/components/game/CountdownOverlay';
import { RoundEndOverlay } from '@/components/game/RoundEndOverlay';
import { RoundStats } from '@/utils/scoring';

const Index = () => {
  const [username] = useState('Champion');
  
  const {
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
  } = useGameState({
    initialRating: 1150,
    username,
  });

  // Track time remaining for the play screen
  const [timeRemaining, setTimeRemaining] = useState(30);
  
  useEffect(() => {
    if (phase === 'playing' && match) {
      setTimeRemaining(match.roundTimeSeconds);
      const interval = setInterval(() => {
        setTimeRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phase, match?.currentRound]);

  // Get the last round result for the overlay
  const lastRoundResult = match?.roundResults[match.roundResults.length - 1] || null;

  // Calculate aggregate stats for results screen
  const getAggregateStats = (): RoundStats => {
    if (!match || match.roundResults.length === 0) {
      return { wpm: 0, accuracy: 100, errors: 0, charactersTyped: 0, correctCharacters: 0 };
    }
    
    const totals = match.roundResults.reduce(
      (acc, r) => ({
        wpm: acc.wpm + r.playerStats.wpm,
        accuracy: acc.accuracy + r.playerStats.accuracy,
        errors: acc.errors + r.playerStats.errors,
        charactersTyped: acc.charactersTyped + r.playerStats.charactersTyped,
        correctCharacters: acc.correctCharacters + r.playerStats.correctCharacters,
      }),
      { wpm: 0, accuracy: 0, errors: 0, charactersTyped: 0, correctCharacters: 0 }
    );

    const count = match.roundResults.length;
    return {
      wpm: Math.round(totals.wpm / count),
      accuracy: Math.round(totals.accuracy / count),
      errors: totals.errors,
      charactersTyped: totals.charactersTyped,
      correctCharacters: totals.correctCharacters,
    };
  };

  const getOpponentAggregateStats = (): RoundStats => {
    if (!match || match.roundResults.length === 0) {
      return { wpm: 0, accuracy: 100, errors: 0, charactersTyped: 0, correctCharacters: 0 };
    }
    
    const totals = match.roundResults.reduce(
      (acc, r) => ({
        wpm: acc.wpm + r.opponentStats.wpm,
        accuracy: acc.accuracy + r.opponentStats.accuracy,
        errors: acc.errors + r.opponentStats.errors,
        charactersTyped: acc.charactersTyped + r.opponentStats.charactersTyped,
        correctCharacters: acc.correctCharacters + r.opponentStats.correctCharacters,
      }),
      { wpm: 0, accuracy: 0, errors: 0, charactersTyped: 0, correctCharacters: 0 }
    );

    const count = match.roundResults.length;
    return {
      wpm: Math.round(totals.wpm / count),
      accuracy: Math.round(totals.accuracy / count),
      errors: totals.errors,
      charactersTyped: totals.charactersTyped,
      correctCharacters: totals.correctCharacters,
    };
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Main content based on phase */}
      {(phase === 'home' || phase === 'queue' || phase === 'match_found') && (
        <HomeScreen
          username={username}
          rating={playerRating}
          onPlayRanked={startQueue}
        />
      )}

      {(phase === 'countdown' || phase === 'playing' || phase === 'round_end') && match && (
        <PlayScreen
          match={match}
          timeRemaining={timeRemaining}
          currentText={getCurrentText()}
          onRoundComplete={handleRoundComplete}
          playerDamage={lastRoundResult?.damageTaken}
          opponentDamage={lastRoundResult?.damageDealt}
        />
      )}

      {phase === 'results' && match && (
        <ResultsScreen
          match={match}
          playerStats={getAggregateStats()}
          opponentStats={getOpponentAggregateStats()}
          eloChange={getEloChange()}
          newRating={playerRating}
          onPlayAgain={playAgain}
        />
      )}

      {/* Overlays */}
      <QueueOverlay
        isVisible={phase === 'queue'}
        onCancel={cancelQueue}
        elapsedTime={queueTime}
      />

      {match && (
        <MatchFoundOverlay
          isVisible={phase === 'match_found'}
          player={player}
          opponent={match.opponent}
        />
      )}

      <CountdownOverlay
        count={countdown > 0 ? countdown : 'GO!'}
        isVisible={phase === 'countdown'}
      />

      <RoundEndOverlay
        isVisible={phase === 'round_end'}
        roundResult={lastRoundResult}
      />
    </div>
  );
};

export default Index;
