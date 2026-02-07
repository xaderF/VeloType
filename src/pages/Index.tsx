// Index.tsx
// main page component — supports both offline (simulated) and online (WebSocket) modes.

import { useState, useEffect, useCallback } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineMatch } from '@/hooks/useOnlineMatch';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { PlayScreen } from '@/components/screens/PlayScreen';
import { ResultsScreen } from '@/components/screens/ResultsScreen';
import { QueueOverlay } from '@/components/game-ui/QueueOverlay';
import { MatchFoundOverlay } from '@/components/game-ui/MatchFoundOverlay';
import { CountdownOverlay } from '@/components/game-ui/CountdownOverlay';
import { RoundEndOverlay } from '@/components/game-ui/RoundEndOverlay';
import { TypingOptionsBar } from '@/components/game-ui/TypingOptionsBar';
import { RoundStats, getRankFromRating } from '@/utils/scoring';
import { TypingArena } from '@/components/game-ui/TypingArena';
import { RankBadge } from '@/components/game-ui/RankBadge';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getSeededText, generateMatchSeed } from '@/utils/textSeed';

// ---------------------------------------------------------------------------
// Auth panel (inline login / register)
// ---------------------------------------------------------------------------

type AuthPanelAuth = Pick<ReturnType<typeof useAuth>, 'login' | 'register' | 'error' | 'loading' | 'clearError'>;

function AuthPanel({ onClose, auth }: { onClose?: () => void; auth: AuthPanelAuth }) {
  const { login, register, error, loading, clearError } = auth;
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await login(username, password);
    } else {
      await register(username, password, email || undefined);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="w-full max-w-sm p-6 rounded-xl border border-border bg-card space-y-4">
        <h2 className="text-xl font-bold text-center">
          {mode === 'login' ? 'Log In' : 'Create Account'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full px-3 py-2 rounded border bg-background text-foreground"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
          />
          {mode === 'register' && (
            <input
              className="w-full px-3 py-2 rounded border bg-background text-foreground"
              placeholder="Email (optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <input
            className="w-full px-3 py-2 rounded border bg-background text-foreground"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-primary text-primary-foreground font-semibold disabled:opacity-50"
          >
            {loading ? 'Loading...' : mode === 'login' ? 'Log In' : 'Register'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); clearError(); }}
          className="w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Log In'}
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Online Play Screen — uses live WebSocket state
// ---------------------------------------------------------------------------

function OnlinePlayScreen({
  targetText,
  timeLimit,
  punctuationEnabled,
  opponent,
  opponentProgress,
  userId,
  onComplete,
  onCompleteRaw,
  onProgressUpdate,
}: {
  targetText: string;
  timeLimit: number;
  punctuationEnabled: boolean;
  opponent: { username: string; rating: number } | null;
  opponentProgress: { typedLength: number; mistakesCount: number; elapsedMs: number } | null;
  userId: string | null;
  onComplete: (stats: RoundStats) => void;
  onCompleteRaw: (typed: string, samples: number[]) => void;
  onProgressUpdate: (typed: string, cursor: number, errors: number, startedAtMs: number | null) => void;
}) {
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);

  useEffect(() => {
    setTimeRemaining(timeLimit);
    const interval = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLimit]);

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 bg-grid-pattern relative">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto w-full flex flex-col gap-8">
        {/* Minimal HUD */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/50">
          <div className="text-sm text-muted-foreground">
            vs <span className="font-semibold text-foreground">{opponent?.username ?? 'Opponent'}</span>
            {opponent && <span className="ml-2 text-xs">({opponent.rating} ELO)</span>}
          </div>
          <div className="text-2xl font-bold font-mono text-primary">{timeRemaining}s</div>
          {opponentProgress && (
            <div className="text-sm text-muted-foreground">
              Opponent: {opponentProgress.typedLength} chars
            </div>
          )}
        </div>

        <TypingOptionsBar
          punctuationEnabled={punctuationEnabled}
          timeLimit={timeLimit}
        />

        {/* Typing Arena */}
        <div className="flex-1 flex items-center">
          <TypingArena
            text={targetText}
            isActive={true}
            timeLimit={timeLimit}
            onComplete={onComplete}
            onCompleteRaw={onCompleteRaw}
            onProgressUpdate={onProgressUpdate}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Online Results Screen
// ---------------------------------------------------------------------------

function OnlineResultsScreen({
  matchResult,
  opponent,
  onPlayAgain,
}: {
  matchResult: NonNullable<ReturnType<typeof useOnlineMatch>['matchResult']>;
  opponent: { username: string; rating: number } | null;
  onPlayAgain: () => void;
}) {
  const my = matchResult.myResult;
  const opp = matchResult.opponentResult;
  const isWin = my.result === 'win';
  const isDraw = my.result === 'draw';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-grid-pattern relative overflow-hidden">
      <motion.div
        className={cn(
          'absolute inset-0 opacity-10',
          isWin
            ? 'bg-gradient-radial from-hp-full/30 via-transparent to-transparent'
            : 'bg-gradient-radial from-damage/30 via-transparent to-transparent',
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.1 }}
      />

      <div className="relative z-10 max-w-2xl w-full space-y-8">
        {/* Result banner */}
        <motion.h1
          className={cn(
            'text-5xl font-bold text-center',
            isWin ? 'text-hp-full' : isDraw ? 'text-muted-foreground' : 'text-damage',
          )}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {isWin ? 'VICTORY' : isDraw ? 'DRAW' : 'DEFEAT'}
        </motion.h1>

        {/* Stats comparison */}
        <motion.div
          className="p-6 rounded-xl border border-border bg-card/80"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground mb-1">You</div>
              <div className="text-2xl font-bold font-mono text-primary">{Math.round(my.wpm)}</div>
              <div className="text-xs text-muted-foreground">WPM</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">vs</div>
              <div className="text-2xl font-bold font-mono">{Math.round((my.accuracy ?? 0) * 100)}%</div>
              <div className="text-xs text-muted-foreground">Your Acc</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">{opponent?.username ?? 'Opponent'}</div>
              <div className="text-2xl font-bold font-mono text-destructive">{Math.round(opp.wpm)}</div>
              <div className="text-xs text-muted-foreground">WPM</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div>Your Score: <span className="text-foreground font-semibold">{Math.round(my.score)}</span></div>
            <div className="text-right">Opp Score: <span className="text-foreground font-semibold">{Math.round(opp.score)}</span></div>
            <div>Errors: <span className="text-foreground">{my.errors}</span></div>
            <div className="text-right">Errors: <span className="text-foreground">{opp.errors}</span></div>
          </div>
        </motion.div>

        {/* Play again */}
        <motion.button
          onClick={onPlayAgain}
          className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          PLAY AGAIN
        </motion.button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Index component
// ---------------------------------------------------------------------------

const Index = () => {
  const auth = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [playMode, setPlayMode] = useState<'offline' | 'online' | 'practice'>('offline');

  // Practice mode state
  const [practicePhase, setPracticePhase] = useState<'typing' | 'results'>('typing');
  const [practiceText, setPracticeText] = useState('');
  const [practiceResults, setPracticeResults] = useState<RoundStats | null>(null);
  const [practiceTimeLimit, setPracticeTimeLimit] = useState<15 | 30 | 60 | 120>(30);
  const [practicePunctuation, setPracticePunctuation] = useState(false);
  const [practiceKey, setPracticeKey] = useState(0); // forces TypingArena remount

  // Offline (simulated) game state
  const offline = useGameState({
    initialRating: auth.user?.rating ?? 0,
    username: auth.user?.username ?? 'Player',
  });

  // Online game state
  const online = useOnlineMatch(auth.token);

  // Track time remaining for offline play screen
  const [timeRemaining, setTimeRemaining] = useState(30);

  useEffect(() => {
    if (playMode === 'offline' && offline.phase === 'playing' && offline.match) {
      setTimeRemaining(offline.match.roundTimeSeconds);
      const interval = setInterval(() => {
        setTimeRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [playMode, offline.phase, offline.match]);

  // Start ranked (online) play
  const startOnlineQueue = useCallback(() => {
    if (!auth.isAuthenticated) {
      setShowAuth(true);
      return;
    }
    setPlayMode('online');
    online.joinQueue();
  }, [auth.isAuthenticated, online]);

  // Start offline practice
  const startOfflineQueue = useCallback(() => {
    setPlayMode('offline');
    offline.startQueue();
  }, [offline]);

  // Start solo practice (MonkeyType-style)
  const startPractice = useCallback(() => {
    const seed = generateMatchSeed();
    const text = getSeededText(seed, {
      length: 200,
      includePunctuation: practicePunctuation,
    });
    setPracticeText(text);
    setPracticeResults(null);
    setPracticePhase('typing');
    setPracticeKey((k) => k + 1);
    setPlayMode('practice');
  }, [practicePunctuation]);

  // Restart practice with new text
  const restartPractice = useCallback(() => {
    const seed = generateMatchSeed();
    const text = getSeededText(seed, {
      length: 200,
      includePunctuation: practicePunctuation,
    });
    setPracticeText(text);
    setPracticeResults(null);
    setPracticePhase('typing');
    setPracticeKey((k) => k + 1);
  }, [practicePunctuation]);

  // Handle practice completion
  const handlePracticeComplete = useCallback((stats: RoundStats) => {
    setPracticeResults(stats);
    setPracticePhase('results');
  }, []);

  // Online round complete handler
  const handleOnlineRoundComplete = useCallback((_stats: RoundStats) => {
    // Stats are secondary; server computes official metrics from typed text
  }, []);

  const handleOnlineCompleteRaw = useCallback((typed: string, samples: number[]) => {
    online.submitResult(typed);
  }, [online]);

  const handleOnlineProgressUpdate = useCallback((typed: string, cursor: number, errors: number, startedAtMs: number | null) => {
    online.updateTypingState(typed, cursor, errors, startedAtMs);
  }, [online]);

  // Close auth panel if user becomes authenticated
  useEffect(() => {
    if (auth.isAuthenticated && showAuth) {
      setShowAuth(false);
    }
  }, [auth.isAuthenticated, showAuth]);

  // Offline state helpers
  const lastRoundResult = offline.match?.roundResults[offline.match.roundResults.length - 1] || null;

  const getAggregateStats = (): RoundStats => {
    if (!offline.match || offline.match.roundResults.length === 0) {
      return { wpm: 0, rawWpm: 0, accuracy: 0, consistency: 1, errors: 0, charactersTyped: 0, correctCharacters: 0 };
    }
    const totals = offline.match.roundResults.reduce(
      (acc, r) => ({
        wpm: acc.wpm + r.playerStats.wpm,
        rawWpm: acc.rawWpm + r.playerStats.rawWpm,
        accuracy: acc.accuracy + r.playerStats.accuracy,
        consistency: acc.consistency + r.playerStats.consistency,
        errors: acc.errors + r.playerStats.errors,
        charactersTyped: acc.charactersTyped + r.playerStats.charactersTyped,
        correctCharacters: acc.correctCharacters + r.playerStats.correctCharacters,
      }),
      { wpm: 0, rawWpm: 0, accuracy: 0, consistency: 0, errors: 0, charactersTyped: 0, correctCharacters: 0 },
    );
    const count = offline.match.roundResults.length;
    return {
      wpm: totals.wpm / count, rawWpm: totals.rawWpm / count,
      accuracy: totals.accuracy / count, consistency: totals.consistency / count,
      errors: totals.errors, charactersTyped: totals.charactersTyped, correctCharacters: totals.correctCharacters,
    };
  };

  const getOpponentAggregateStats = (): RoundStats => {
    if (!offline.match || offline.match.roundResults.length === 0) {
      return { wpm: 0, rawWpm: 0, accuracy: 0, consistency: 1, errors: 0, charactersTyped: 0, correctCharacters: 0 };
    }
    const totals = offline.match.roundResults.reduce(
      (acc, r) => ({
        wpm: acc.wpm + r.opponentStats.wpm,
        rawWpm: acc.rawWpm + r.opponentStats.rawWpm,
        accuracy: acc.accuracy + r.opponentStats.accuracy,
        consistency: acc.consistency + r.opponentStats.consistency,
        errors: acc.errors + r.opponentStats.errors,
        charactersTyped: acc.charactersTyped + r.opponentStats.charactersTyped,
        correctCharacters: acc.correctCharacters + r.opponentStats.correctCharacters,
      }),
      { wpm: 0, rawWpm: 0, accuracy: 0, consistency: 0, errors: 0, charactersTyped: 0, correctCharacters: 0 },
    );
    const count = offline.match.roundResults.length;
    return {
      wpm: totals.wpm / count, rawWpm: totals.rawWpm / count,
      accuracy: totals.accuracy / count, consistency: totals.consistency / count,
      errors: totals.errors, charactersTyped: totals.charactersTyped, correctCharacters: totals.correctCharacters,
    };
  };

  // ---- ONLINE MODE rendering ----
  if (playMode === 'online') {
    return (
      <div className="min-h-screen bg-background">
        {/* Queuing */}
        {online.phase === 'idle' && (
          <HomeScreen
            username={auth.user?.username ?? 'Player'}
            rating={auth.user?.rating ?? null}
            onPlayRanked={startOnlineQueue}
          />
        )}

        {online.phase === 'queuing' && (
          <>
            <HomeScreen
              username={auth.user?.username ?? 'Player'}
              rating={auth.user?.rating ?? null}
              onPlayRanked={startOnlineQueue}
            />
            <QueueOverlay
              isVisible
              onCancel={() => { online.cancelQueue(); setPlayMode('offline'); }}
              elapsedTime={online.queueTime}
            />
          </>
        )}

        {/* Match found */}
        {online.phase === 'match_found' && (
          <>
            <HomeScreen
              username={auth.user?.username ?? 'Player'}
              rating={auth.user?.rating ?? null}
              onPlayRanked={() => {}}
            />
            <MatchFoundOverlay
              isVisible
              player={{
                id: online.userId ?? '',
                username: auth.user?.username ?? 'Player',
                rating: auth.user?.rating ?? 0,
                rank: auth.user ? getRankFromRating(auth.user.rating).rank : 'bronze',
                hp: 100,
                maxHp: 100,
              }}
              opponent={{
                id: online.opponent?.userId ?? '',
                username: online.opponent?.username ?? 'Opponent',
                rating: online.opponent?.rating ?? 0,
                rank: online.opponent?.rating ? getRankFromRating(online.opponent.rating).rank : 'bronze',
                hp: 100,
                maxHp: 100,
              }}
            />
          </>
        )}

        {/* Countdown */}
        {online.phase === 'countdown' && (
          <>
            <div className="min-h-screen" />
            <CountdownOverlay count={online.countdown > 0 ? online.countdown : 'GO!'} isVisible />
          </>
        )}

        {/* Playing */}
        {(online.phase === 'playing' || online.phase === 'waiting_opponent') && (
          <OnlinePlayScreen
            targetText={online.targetText}
            timeLimit={online.matchConfig?.limit ?? 30}
            punctuationEnabled={online.matchConfig?.includePunctuation ?? false}
            opponent={online.opponent}
            opponentProgress={online.opponentProgress}
            userId={online.userId}
            onComplete={handleOnlineRoundComplete}
            onCompleteRaw={handleOnlineCompleteRaw}
            onProgressUpdate={handleOnlineProgressUpdate}
          />
        )}

        {/* Complete */}
        {online.phase === 'complete' && online.matchResult && (
          <OnlineResultsScreen
            matchResult={online.matchResult}
            opponent={online.opponent}
            onPlayAgain={() => { online.resetMatch(); setPlayMode('offline'); }}
          />
        )}

        {/* Error display */}
        {online.error && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm">
            {online.error}
          </div>
        )}

        {showAuth && <AuthPanel auth={auth} onClose={() => { setShowAuth(false); setPlayMode('offline'); }} />}
      </div>
    );
  }

  // ---- PRACTICE MODE rendering (MonkeyType-style solo) ----
  if (playMode === 'practice') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="w-full max-w-4xl mx-auto pt-8 px-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setPlayMode('offline')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-primary">Velo</span>
              <span className="text-foreground">Type</span>
            </h1>
            <div className="w-12" /> {/* Spacer for centering */}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-16">
          <div className="w-full max-w-4xl space-y-8">
            {/* Settings bar — only interactive before/after typing */}
            {practicePhase === 'typing' && (
              <TypingOptionsBar
                punctuationEnabled={practicePunctuation}
                timeLimit={practiceTimeLimit}
                onTogglePunctuation={() => {
                  setPracticePunctuation((p) => !p);
                  // Regenerate text with new setting
                  const seed = generateMatchSeed();
                  const text = getSeededText(seed, {
                    length: 200,
                    includePunctuation: !practicePunctuation,
                  });
                  setPracticeText(text);
                  setPracticeKey((k) => k + 1);
                }}
                onTimeLimitChange={(seconds) => {
                  setPracticeTimeLimit(seconds as 15 | 30 | 60 | 120);
                  // Reset the test with new time
                  const seed = generateMatchSeed();
                  const text = getSeededText(seed, {
                    length: 200,
                    includePunctuation: practicePunctuation,
                  });
                  setPracticeText(text);
                  setPracticeKey((k) => k + 1);
                }}
              />
            )}

            <AnimatePresence mode="wait">
              {practicePhase === 'typing' && (
                <motion.div
                  key={`typing-${practiceKey}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <TypingArena
                    key={practiceKey}
                    text={practiceText}
                    isActive={true}
                    timeLimit={practiceTimeLimit}
                    onComplete={handlePracticeComplete}
                  />
                </motion.div>
              )}

              {practicePhase === 'results' && practiceResults && (
                <motion.div
                  key="results"
                  className="space-y-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Hero stats — WPM + Accuracy large */}
                  <div className="flex items-end justify-center gap-12">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground mb-1">wpm</div>
                      <div className="text-6xl font-bold font-mono text-primary">
                        {Math.round(practiceResults.wpm)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground mb-1">accuracy</div>
                      <div className="text-6xl font-bold font-mono text-primary">
                        {Math.round(practiceResults.accuracy * 100)}%
                      </div>
                    </div>
                  </div>

                  {/* Secondary stats row */}
                  <div className="flex items-center justify-center gap-8 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground">raw</div>
                      <div className="text-lg font-mono font-semibold text-foreground">
                        {Math.round(practiceResults.rawWpm)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">characters</div>
                      <div className="text-lg font-mono font-semibold text-foreground">
                        <span className="text-green-400">{practiceResults.correctCharacters}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-red-400">{practiceResults.errors}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">consistency</div>
                      <div className="text-lg font-mono font-semibold text-foreground">
                        {Math.round(practiceResults.consistency * 100)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">time</div>
                      <div className="text-lg font-mono font-semibold text-foreground">
                        {practiceTimeLimit}s
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-center gap-4">
                    <motion.button
                      onClick={restartPractice}
                      className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-lg"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Next Test
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Restart hint */}
            {practicePhase === 'typing' && (
              <motion.div
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <button
                  onClick={restartPractice}
                  className="text-muted-foreground/40 hover:text-muted-foreground text-sm transition-colors"
                >
                  ↻ restart test
                </button>
              </motion.div>
            )}
          </div>
        </div>

        {showAuth && <AuthPanel auth={auth} onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  // ---- OFFLINE MODE rendering (original simulated) ----
  return (
    <div className="min-h-screen bg-background">
      {/* Home with both play options */}
      {(offline.phase === 'home' || offline.phase === 'queue' || offline.phase === 'match_found') && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
          <motion.div
            className="relative z-10 text-center space-y-12 max-w-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-2">
                <span className="text-primary">Velo</span>
                <span className="text-foreground">Type</span>
              </h1>
              <p className="text-muted-foreground">Minimal, deterministic 1v1 typing duels</p>
            </motion.div>

            {/* Player card */}
            <motion.div
              className="p-6 rounded-2xl border border-border bg-card/80 backdrop-blur-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-center gap-4 mb-2">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl border-2 border-primary">
                  👤
                </div>
                <div className="text-left">
                  <div className="text-lg font-semibold">{auth.user?.username ?? 'Player'}</div>
                  {auth.user ? (
                    <RankBadge rating={auth.user.rating} size="sm" />
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold mt-1">Unranked</span>
                  )}
                </div>
              </div>
              {auth.isAuthenticated ? (
                <button onClick={auth.logout} className="text-xs text-muted-foreground hover:text-foreground">
                  Log out ({auth.user?.username})
                </button>
              ) : (
                <button onClick={() => setShowAuth(true)} className="text-xs text-primary hover:underline">
                  Log in to play ranked
                </button>
              )}
            </motion.div>

            <TypingOptionsBar
              punctuationEnabled={offline.practiceSettings.punctuation}
              timeLimit={offline.practiceSettings.timeLimitSeconds}
              onTogglePunctuation={() =>
                offline.updatePracticeSettings({ punctuation: !offline.practiceSettings.punctuation })
              }
              onTimeLimitChange={(seconds) =>
                offline.updatePracticeSettings({ timeLimitSeconds: seconds as 15 | 30 | 60 | 120 })
              }
            />

            {/* Play buttons */}
            <div className="flex flex-col gap-3">
              <motion.button
                onClick={startOnlineQueue}
                className={cn(
                  'w-full py-4 px-8 rounded-xl font-bold text-lg',
                  'bg-primary text-primary-foreground',
                  'glow-primary hover:glow-primary-intense',
                  'transition-all duration-300',
                  'border-2 border-primary/50',
                )}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                ⚔️ PLAY RANKED
              </motion.button>

              <motion.button
                onClick={startOfflineQueue}
                className={cn(
                  'w-full py-3 px-8 rounded-xl font-semibold',
                  'bg-secondary text-secondary-foreground',
                  'hover:bg-secondary/80 transition-all duration-200',
                  'border border-border',
                )}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                🎯 PRACTICE (vs Bot)
              </motion.button>

              <motion.button
                onClick={startPractice}
                className={cn(
                  'w-full py-3 px-8 rounded-xl font-semibold',
                  'bg-muted text-muted-foreground',
                  'hover:bg-muted/80 hover:text-foreground transition-all duration-200',
                  'border border-border/50',
                )}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                ⌨️ FREE TYPE
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {(offline.phase === 'countdown' || offline.phase === 'playing' || offline.phase === 'round_end') && offline.match && (
        <PlayScreen
          match={offline.match}
          timeRemaining={timeRemaining}
          currentText={offline.getCurrentText()}
          onRoundComplete={offline.handleRoundComplete}
          playerDamage={lastRoundResult?.damageTaken}
          opponentDamage={lastRoundResult?.damageDealt}
          punctuationEnabled={offline.match.textSettings.punctuation}
        />
      )}

      {offline.phase === 'results' && offline.match && (
        <ResultsScreen
          match={offline.match}
          playerStats={getAggregateStats()}
          opponentStats={getOpponentAggregateStats()}
          eloChange={offline.getEloChange()}
          newRating={offline.playerRating}
          onPlayAgain={offline.playAgain}
        />
      )}

      {/* Overlays */}
      <QueueOverlay isVisible={offline.phase === 'queue'} onCancel={offline.cancelQueue} elapsedTime={offline.queueTime} />

      {offline.match && (
        <MatchFoundOverlay isVisible={offline.phase === 'match_found'} player={offline.player} opponent={offline.match.opponent} />
      )}

      <CountdownOverlay count={offline.countdown > 0 ? offline.countdown : 'GO!'} isVisible={offline.phase === 'countdown'} />

      <RoundEndOverlay
        isVisible={offline.phase === 'round_end'}
        roundResult={lastRoundResult}
        drawAvailable={Boolean(offline.match && offline.match.roundResults.length >= 10)}
        drawOffered={offline.drawOffered}
        drawAccepted={offline.drawAccepted}
        onOfferDraw={offline.offerDraw}
        breakSeconds={15}
      />

      {showAuth && <AuthPanel auth={auth} onClose={() => setShowAuth(false)} />}
    </div>
  );
};

export default Index;
