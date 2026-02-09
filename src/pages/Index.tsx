// Index.tsx
// main page component — supports both offline (simulated) and online (WebSocket) modes.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameState } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineMatch } from '@/hooks/useOnlineMatch';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { PlayModeSelect } from '@/components/screens/PlayModeSelect';
import { SettingsPanel } from '@/components/screens/SettingsPanel';
import { PlayScreen } from '@/components/screens/PlayScreen';
import { ResultsScreen } from '@/components/screens/ResultsScreen';
import { QueueOverlay } from '@/components/game-ui/QueueOverlay';
import { MatchFoundOverlay } from '@/components/game-ui/MatchFoundOverlay';
import { CountdownOverlay } from '@/components/game-ui/CountdownOverlay';
import { RoundEndOverlay } from '@/components/game-ui/RoundEndOverlay';
import { FpsOverlay } from '@/components/game-ui/FpsOverlay';
import { TypingOptionsBar } from '@/components/game-ui/TypingOptionsBar';
import { LetterParticles } from '@/components/game-ui/LetterParticles';
import { ForfeitConfirmDialog } from '@/components/game-ui/ForfeitConfirmDialog';
import { RoundStats } from '@/utils/scoring';
import type { MatchState } from '@/types/game';
import { TypingArena } from '@/components/game-ui/TypingArena';
import { WpmChart } from '@/components/game-ui/WpmChart';
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await login(username, password, staySignedIn);
    } else {
      await register(username, password, email, staySignedIn);
    }
  };

  // Focus trap + Escape key for dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Focus first input on mount
    const firstInput = dialog.querySelector<HTMLInputElement>('input');
    firstInput?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'input, button, a[href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'login' ? 'Log in' : 'Create account'}
      ref={dialogRef}
    >
      <div className="w-full max-w-sm p-6 rounded-xl border border-border bg-card space-y-4">
        <h2 className="text-xl font-bold text-center">
          {mode === 'login' ? 'Log In' : 'Create Account'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full px-3 py-2 rounded border bg-background text-foreground"
            placeholder="Username"
            aria-label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
          />
          {mode === 'register' && (
            <input
              className="w-full px-3 py-2 rounded border bg-background text-foreground"
              placeholder="Email"
              aria-label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
          <input
            className="w-full px-3 py-2 rounded border bg-background text-foreground"
            placeholder="Password"
            aria-label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />

          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={staySignedIn}
              onChange={(e) => setStaySignedIn(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-muted-foreground">Stay signed in</span>
          </label>

          {mode === 'register' && (
            <div className="space-y-2 text-sm">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span className="text-muted-foreground">
                  I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline">Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">Privacy Policy</a>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span className="text-muted-foreground">I confirm I am at least 13 years old</span>
              </label>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading || (mode === 'register' && (!acceptedTerms || !ageConfirmed || !email.trim()))}
            className="w-full py-2 rounded bg-primary text-primary-foreground font-semibold disabled:opacity-50"
          >
            {loading ? 'Loading...' : mode === 'login' ? 'Log In' : 'Register'}
          </button>
        </form>

        <p className="w-full text-sm text-muted-foreground text-center">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); clearError(); }}
            className="text-foreground hover:text-primary underline underline-offset-2 transition-colors"
          >
            {mode === 'login' ? 'Register' : 'Log In'}
          </button>
        </p>

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
  isTypingActive,
  opponent,
  opponentProgress,
  userId,
  onComplete,
  onCompleteRaw,
  onProgressUpdate,
  onForfeit,
}: {
  targetText: string;
  timeLimit: number;
  punctuationEnabled: boolean;
  isTypingActive: boolean;
  opponent: { username: string; rating: number | null } | null;
  opponentProgress: { typedLength: number; mistakesCount: number; elapsedMs: number } | null;
  userId: string | null;
  onComplete: (stats: RoundStats) => void;
  onCompleteRaw: (typed: string, samples: number[]) => void;
  onProgressUpdate: (typed: string, cursor: number, errors: number, startedAtMs: number | null) => void;
  onForfeit?: () => void;
}) {
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [showForfeitDialog, setShowForfeitDialog] = useState(false);

  useEffect(() => {
    setTimeRemaining(timeLimit);
    const interval = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLimit]);

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 bg-lobby-bg relative overflow-hidden">
      <LetterParticles />
      <div
        className={cn(
          'absolute inset-0 pointer-events-none transition-all duration-300',
          isTypingActive
            ? 'bg-lobby-bg/65 backdrop-blur-xl'
            : 'bg-lobby-bg/45 backdrop-blur-[2px]',
        )}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-lobby-bg/40 pointer-events-none" />

      {/* Forfeit button — top left */}
      {onForfeit && (
        <motion.button
          onClick={() => setShowForfeitDialog(true)}
          className="absolute top-4 left-4 z-30 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          ✕ Forfeit
        </motion.button>
      )}

      <ForfeitConfirmDialog
        isOpen={showForfeitDialog}
        onCancel={() => setShowForfeitDialog(false)}
        onConfirm={() => {
          setShowForfeitDialog(false);
          onForfeit?.();
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto w-full flex flex-col gap-8">
        {/* Minimal HUD */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/50">
          <div className="text-sm text-muted-foreground">
            vs <span className="font-semibold text-foreground">{opponent?.username ?? 'Opponent'}</span>
            {opponent && (
              <span className="ml-2 text-xs">
                ({opponent.rating == null ? 'UNRANKED' : `${opponent.rating} ELO`})
              </span>
            )}
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
            isActive={isTypingActive}
            timeLimit={timeLimit}
            onComplete={onComplete}
            onCompleteRaw={onCompleteRaw}
            onProgressUpdate={onProgressUpdate}
            focusMode={isTypingActive}
            startOnFirstKeystroke={false}
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
  match,
  opponent,
  onBackToMenu,
}: {
  matchResult: NonNullable<ReturnType<typeof useOnlineMatch>['matchResult']>;
  match: MatchState | null;
  opponent: { username: string; rating: number | null } | null;
  onBackToMenu: () => void;
}) {
  const my = matchResult.myResult;
  const opp = matchResult.opponentResult;
  const isWin = my.result === 'win';
  const isDraw = my.result === 'draw';
  const roundResults = match?.roundResults ?? [];
  const scoreline = `${roundResults.filter((r) => r.winner === 'player').length}-${roundResults.filter((r) => r.winner === 'opponent').length}`;

  const comparisonRows = [
    { label: 'WPM', my: Math.round(my.wpm), opp: Math.round(opp.wpm), suffix: '' },
    { label: 'Accuracy', my: Math.round((my.accuracy ?? 0) * 100), opp: Math.round((opp.accuracy ?? 0) * 100), suffix: '%' },
    { label: 'Consistency', my: Math.round((my.consistency ?? 0) * 100), opp: Math.round((opp.consistency ?? 0) * 100), suffix: '%' },
    { label: 'Raw WPM', my: Math.round(my.rawWpm ?? 0), opp: Math.round(opp.rawWpm ?? 0), suffix: '' },
    { label: 'Score', my: Math.round(my.score), opp: Math.round(opp.score), suffix: '' },
    { label: 'Errors', my: my.errors, opp: opp.errors, suffix: '', lowerIsBetter: true },
    { label: 'Damage', my: Math.round(my.damageDealt ?? 0), opp: Math.round(opp.damageDealt ?? 0), suffix: '' },
  ];

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

      <div className="relative z-10 max-w-4xl w-full space-y-6">
        {/* Result banner */}
        <motion.h1
          className={cn(
            'text-6xl font-bold text-center',
            isWin ? 'text-hp-full' : isDraw ? 'text-muted-foreground' : 'text-damage',
          )}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {isWin ? 'VICTORY' : isDraw ? 'DRAW' : 'DEFEAT'}
        </motion.h1>

        <motion.p
          className="text-center text-sm text-muted-foreground -mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          Final score: {scoreline}
        </motion.p>

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
              <div className="text-4xl font-bold font-mono text-primary">{Math.round(my.wpm)}</div>
              <div className="text-xs text-muted-foreground">WPM</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">ELO</div>
              <div className={cn(
                'text-3xl font-bold font-mono',
                (my.ratingDelta ?? 0) > 0 && 'text-hp-full',
                (my.ratingDelta ?? 0) < 0 && 'text-damage',
                (my.ratingDelta ?? 0) === 0 && 'text-muted-foreground',
              )}
              >
                {(my.ratingDelta ?? 0) > 0 ? '+' : ''}{my.ratingDelta ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">rating change</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">{opponent?.username ?? 'Opponent'}</div>
              <div className="text-4xl font-bold font-mono text-destructive">{Math.round(opp.wpm)}</div>
              <div className="text-xs text-muted-foreground">WPM</div>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {comparisonRows.map((row) => {
              const myWins = row.lowerIsBetter ? row.my < row.opp : row.my > row.opp;
              const oppWins = row.lowerIsBetter ? row.opp < row.my : row.opp > row.my;
              const myText = `${row.my}${row.suffix}`;
              const oppText = `${row.opp}${row.suffix}`;

              return (
                <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
                  <div className={cn('font-mono text-right', myWins && 'text-hp-full font-semibold')}>{myText}</div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</div>
                  <div className={cn('font-mono', oppWins && 'text-hp-full font-semibold')}>{oppText}</div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {roundResults.length > 0 && (
          <motion.div
            className="p-5 rounded-xl border border-border bg-card/70"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Round Recap
            </h3>
            <div className="round-recap-scrollbar flex gap-3 overflow-x-scroll pb-2 snap-x snap-mandatory">
              {roundResults.map((round) => (
                <div
                  key={round.roundNumber}
                  className="min-w-[220px] snap-start rounded-lg border border-border/80 bg-background/40 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Round {round.roundNumber}</span>
                    <span
                      className={cn(
                        'text-xs font-semibold uppercase',
                        round.winner === 'player' && 'text-hp-full',
                        round.winner === 'opponent' && 'text-damage',
                        round.winner === 'draw' && 'text-muted-foreground',
                      )}
                    >
                      {round.winner === 'player' ? 'Win' : round.winner === 'opponent' ? 'Loss' : 'Draw'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded border border-border/60 bg-background/50 px-2 py-1">
                      <span className="text-muted-foreground">You</span>
                      <span className="ml-2 font-mono">{Math.round(round.playerStats.wpm)} wpm</span>
                    </div>
                    <div className="rounded border border-border/60 bg-background/50 px-2 py-1">
                      <span className="text-muted-foreground">Opp</span>
                      <span className="ml-2 font-mono">{Math.round(round.opponentStats.wpm)} wpm</span>
                    </div>
                    <div className="rounded border border-border/60 bg-background/50 px-2 py-1 col-span-2">
                      <span className="text-muted-foreground">Damage</span>
                      <span className="ml-2 font-mono">
                        +{Math.round(round.damageDealt)} / -{Math.round(round.damageTaken)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Back to menu */}
        <motion.button
          onClick={onBackToMenu}
          className="w-full py-4 px-8 rounded-xl bg-primary text-primary-foreground font-bold text-xl uppercase tracking-[0.08em] hover:bg-primary/90 transition-all duration-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          BACK TO MENU
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
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);
  const [playMode, setPlayMode] = useState<'offline' | 'online' | 'practice'>('offline');
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showOnlineRoundEndForfeitDialog, setShowOnlineRoundEndForfeitDialog] = useState(false);
  const [showFps, setShowFps] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('velotype:show-fps') === '1';
    } catch {
      return false;
    }
  });

  // Last match result for the right sidebar
  const [lastMatchData, setLastMatchData] = useState<{
    wpm: number;
    accuracy: number;
    result: 'win' | 'loss' | 'draw';
  } | null>(null);

  // Practice mode state
  const [practicePhase, setPracticePhase] = useState<'typing' | 'results'>('typing');
  const [practiceText, setPracticeText] = useState('');
  const [practiceResults, setPracticeResults] = useState<RoundStats | null>(null);
  const [practiceTimeLimit, setPracticeTimeLimit] = useState<0 | 15 | 30 | 60 | 120>(30);
  const [practicePunctuation, setPracticePunctuation] = useState(false);
  const [practiceKey, setPracticeKey] = useState(0); // forces TypingArena remount
  const [practiceStarted, setPracticeStarted] = useState(false); // true once first key pressed

  // Offline (simulated) game state
  const offline = useGameState({
    initialRating: auth.user?.rating ?? 0,
    username: auth.user?.username ?? 'Player',
  });

  // Online game state
  const online = useOnlineMatch(auth.token);

  // Track time remaining for offline play screen
  const [timeRemaining, setTimeRemaining] = useState(30);
  const isPracticeEndless = practiceTimeLimit === 0;
  const practiceRoundSeconds = isPracticeEndless ? 30 : practiceTimeLimit;

  useEffect(() => {
    if (playMode === 'offline' && offline.phase === 'playing' && offline.match) {
      setTimeRemaining(offline.match.roundTimeSeconds);
      const interval = setInterval(() => {
        setTimeRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [playMode, offline.phase, offline.match]);

  useEffect(() => {
    try {
      window.localStorage.setItem('velotype:show-fps', showFps ? '1' : '0');
    } catch {
      // Ignore storage failures (private mode, quota limits, etc.)
    }
  }, [showFps]);

  // Start ranked (online) play
  const startOnlineQueue = useCallback(() => {
    if (!auth.isAuthenticated) {
      setShowAuth(true);
      return;
    }
    if (online.phase !== 'idle') {
      return;
    }
    online.joinQueue();
  }, [auth.isAuthenticated, online]);

  const cancelCompetitiveQueue = useCallback(() => {
    online.cancelQueue();
    setPlayMode('offline');
  }, [online]);

  // Start versus-bot queue (shown inside PlayModeSelect, like competitive queue).
  const startOfflineQueue = useCallback(() => {
    setPlayMode('offline');
    offline.startQueue();
  }, [offline]);

  const cancelBotQueue = useCallback(() => {
    offline.cancelQueue();
  }, [offline]);

  const buildPracticeText = useCallback(
    (includePunctuation: boolean, limit: 0 | 15 | 30 | 60 | 120) => {
      const seed = generateMatchSeed();
      return getSeededText(seed, {
        length: limit === 0 ? 4000 : 200,
        includePunctuation,
      });
    },
    [],
  );

  // Start solo practice (MonkeyType-style)
  const startPractice = useCallback(() => {
    const text = buildPracticeText(practicePunctuation, practiceTimeLimit);
    setPracticeText(text);
    setPracticeResults(null);
    setPracticePhase('typing');
    setPracticeStarted(false);
    setPracticeKey((k) => k + 1);
    setShowModeSelect(false);
    setPlayMode('practice');
  }, [buildPracticeText, practicePunctuation, practiceTimeLimit]);

  // Open the mode-select sub-screen
  const openModeSelect = useCallback(() => {
    setShowModeSelect(true);
  }, []);

  const closeModeSelect = useCallback(() => {
    if (online.phase === 'queuing') {
      online.cancelQueue();
      setPlayMode('offline');
    }
    if (offline.phase === 'queue') {
      offline.cancelQueue();
    }
    setShowModeSelect(false);
  }, [offline, online]);

  // Restart practice with new text
  const restartPractice = useCallback(() => {
    const text = buildPracticeText(practicePunctuation, practiceTimeLimit);
    setPracticeText(text);
    setPracticeResults(null);
    setPracticePhase('typing');
    setPracticeStarted(false);
    setPracticeKey((k) => k + 1);
  }, [buildPracticeText, practicePunctuation, practiceTimeLimit]);

  // Handle practice completion
  const handlePracticeComplete = useCallback((stats: RoundStats) => {
    setPracticeResults(stats);
    setPracticePhase('results');
  }, []);

  // Online round complete handler
  const handleOnlineRoundComplete = useCallback((stats: RoundStats) => {
    online.registerLocalRoundStats(stats, online.match?.currentRound);
  }, [online]);

  const handleOnlineCompleteRaw = useCallback((typed: string, _samples: number[], totalErrors: number, totalKeystrokes: number) => {
    online.submitResult(typed, totalErrors, totalKeystrokes);
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

  // Keep the mode-select screen stable while queueing to avoid mount/unmount flicker.
  // Move to online flow only when an actual match lifecycle starts.
  useEffect(() => {
    if (
      online.phase === 'match_found' ||
      online.phase === 'prepare' ||
      online.phase === 'countdown' ||
      online.phase === 'playing' ||
      online.phase === 'waiting_opponent' ||
      online.phase === 'round_end' ||
      online.phase === 'complete' ||
      online.phase === 'reconnecting'
    ) {
      setPlayMode('online');
    }
  }, [online.phase]);

  // Auto-hide mode select once a competitive match is found/started.
  useEffect(() => {
    if (!showModeSelect) return;
    if (
      online.phase === 'match_found' ||
      online.phase === 'prepare' ||
      online.phase === 'countdown' ||
      online.phase === 'playing' ||
      online.phase === 'waiting_opponent' ||
      online.phase === 'round_end' ||
      online.phase === 'complete' ||
      online.phase === 'reconnecting'
    ) {
      setShowModeSelect(false);
    }
  }, [online.phase, showModeSelect]);

  // Auto-hide mode select once bot queue progresses into match flow.
  useEffect(() => {
    if (!showModeSelect) return;
    if (
      offline.phase === 'match_found' ||
      offline.phase === 'countdown' ||
      offline.phase === 'playing' ||
      offline.phase === 'round_end' ||
      offline.phase === 'results'
    ) {
      setShowModeSelect(false);
    }
  }, [offline.phase, showModeSelect]);

  // Offline state helpers
  const lastRoundResult = offline.match?.roundResults[offline.match.roundResults.length - 1] || null;
  const onlineLastRoundResult = online.match?.roundResults[online.match.roundResults.length - 1] || null;

  // Forfeit handler for offline (1v AI) — immediately go home
  const handleOfflineForfeit = useCallback(() => {
    offline.playAgain();
    setPlayMode('offline');
  }, [offline]);

  // Forfeit handler for online (competitive) — reset match and go home
  const handleOnlineForfeit = useCallback(() => {
    online.forfeitMatch();
    setPlayMode('offline');
  }, [online]);

  const getAggregateStats = (): RoundStats => {
    if (!offline.match || offline.match.roundResults.length === 0) {
      return { wpm: 0, rawWpm: 0, accuracy: 0, consistency: 1, errors: 0, totalErrors: 0, charactersTyped: 0, correctCharacters: 0 };
    }
    const totals = offline.match.roundResults.reduce(
      (acc, r) => ({
        wpm: acc.wpm + r.playerStats.wpm,
        rawWpm: acc.rawWpm + r.playerStats.rawWpm,
        accuracy: acc.accuracy + r.playerStats.accuracy,
        consistency: acc.consistency + r.playerStats.consistency,
        errors: acc.errors + r.playerStats.errors,
        totalErrors: acc.totalErrors + (r.playerStats.totalErrors ?? r.playerStats.errors),
        charactersTyped: acc.charactersTyped + r.playerStats.charactersTyped,
        correctCharacters: acc.correctCharacters + r.playerStats.correctCharacters,
      }),
      { wpm: 0, rawWpm: 0, accuracy: 0, consistency: 0, errors: 0, totalErrors: 0, charactersTyped: 0, correctCharacters: 0 },
    );
    const count = offline.match.roundResults.length;

    // Merge wpmHistory from all rounds with cumulative time offsets
    const wpmHistory: import('@/utils/scoring').WpmHistoryPoint[] = [];
    let timeOffset = 0;
    for (const r of offline.match.roundResults) {
      const h = r.playerStats.wpmHistory;
      if (h && h.length > 0) {
        for (const p of h) {
          wpmHistory.push({ ...p, second: p.second + timeOffset });
        }
        timeOffset += h[h.length - 1].second;
      }
    }

    return {
      wpm: totals.wpm / count, rawWpm: totals.rawWpm / count,
      accuracy: totals.accuracy / count, consistency: totals.consistency / count,
      errors: totals.errors, totalErrors: totals.totalErrors,
      charactersTyped: totals.charactersTyped, correctCharacters: totals.correctCharacters,
      wpmHistory: wpmHistory.length > 0 ? wpmHistory : undefined,
    };
  };

  const getOpponentAggregateStats = (): RoundStats => {
    if (!offline.match || offline.match.roundResults.length === 0) {
      return { wpm: 0, rawWpm: 0, accuracy: 0, consistency: 1, errors: 0, totalErrors: 0, charactersTyped: 0, correctCharacters: 0 };
    }
    const totals = offline.match.roundResults.reduce(
      (acc, r) => ({
        wpm: acc.wpm + r.opponentStats.wpm,
        rawWpm: acc.rawWpm + r.opponentStats.rawWpm,
        accuracy: acc.accuracy + r.opponentStats.accuracy,
        consistency: acc.consistency + r.opponentStats.consistency,
        errors: acc.errors + r.opponentStats.errors,
        totalErrors: acc.totalErrors + (r.opponentStats.totalErrors ?? r.opponentStats.errors),
        charactersTyped: acc.charactersTyped + r.opponentStats.charactersTyped,
        correctCharacters: acc.correctCharacters + r.opponentStats.correctCharacters,
      }),
      { wpm: 0, rawWpm: 0, accuracy: 0, consistency: 0, errors: 0, totalErrors: 0, charactersTyped: 0, correctCharacters: 0 },
    );
    const count = offline.match.roundResults.length;
    return {
      wpm: totals.wpm / count, rawWpm: totals.rawWpm / count,
      accuracy: totals.accuracy / count, consistency: totals.consistency / count,
      errors: totals.errors, totalErrors: totals.totalErrors,
      charactersTyped: totals.charactersTyped, correctCharacters: totals.correctCharacters,
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
            isAuthenticated={auth.isAuthenticated}
            lastMatch={lastMatchData}
            onPlay={openModeSelect}
            onCareer={() => navigate('/profile')}
            onLeaderboard={() => navigate('/leaderboard')}
            onSettings={() => setShowSettings(true)}
            onLogin={() => setShowAuth(true)}
            onLogout={auth.logout}
          />
        )}

        {online.phase === 'queuing' && (
          <>
            <HomeScreen
              username={auth.user?.username ?? 'Player'}
              rating={auth.user?.rating ?? null}
              isAuthenticated={auth.isAuthenticated}
              lastMatch={lastMatchData}
              onPlay={openModeSelect}
              onCareer={() => navigate('/profile')}
              onLeaderboard={() => navigate('/leaderboard')}
              onSettings={() => setShowSettings(true)}
              onLogin={() => setShowAuth(true)}
              onLogout={auth.logout}
            />
          </>
        )}

        {/* Match found / prepare */}
        {(online.phase === 'match_found' || online.phase === 'prepare') && (
          <>
            <HomeScreen
              username={auth.user?.username ?? 'Player'}
              rating={auth.user?.rating ?? null}
              isAuthenticated={auth.isAuthenticated}
              lastMatch={lastMatchData}
              onPlay={() => {}}
              onCareer={() => {}}
              onLeaderboard={() => {}}
              onSettings={() => {}}
              onLogin={() => {}}
              onLogout={() => {}}
            />
            <MatchFoundOverlay
              isVisible
              player={{
                username: online.match?.player.username ?? auth.user?.username ?? 'Player',
                rating: auth.user?.rating ?? null,
              }}
              opponent={{
                username: online.match?.opponent.username ?? online.opponent?.username ?? 'Opponent',
                rating: online.opponent?.rating ?? null,
              }}
              loadingProgress={online.matchFoundProgress ?? undefined}
              loadingLabel="Loading..."
            />
          </>
        )}

        {/* Shared gameplay shell (identical to 1vAI layout) */}
        {(online.phase === 'countdown' ||
          online.phase === 'playing' ||
          online.phase === 'waiting_opponent' ||
          online.phase === 'round_end') && online.match && (
          <>
            <PlayScreen
              match={online.match}
              timeRemaining={online.timeRemaining}
              currentText={online.targetText}
              onRoundComplete={handleOnlineRoundComplete}
              onRoundCompleteRaw={handleOnlineCompleteRaw}
              onProgressUpdate={handleOnlineProgressUpdate}
              playerDamage={onlineLastRoundResult?.damageTaken}
              opponentDamage={onlineLastRoundResult?.damageDealt}
              punctuationEnabled={online.matchConfig?.includePunctuation ?? false}
              isTypingActive={online.phase === 'playing'}
              onForfeit={handleOnlineForfeit}
              confirmForfeit
            />

            <CountdownOverlay
              count={online.countdown > 0 ? online.countdown : 'GO!'}
              isVisible={online.phase === 'countdown'}
            />

            <RoundEndOverlay
              isVisible={online.phase === 'round_end'}
              roundResult={onlineLastRoundResult}
              breakSeconds={Math.max(0, online.breakSeconds)}
              playerName={online.match.player.username}
              opponentName={online.match.opponent.username}
              playerHp={online.match.player.hp}
              opponentHp={online.match.opponent.hp}
              maxHp={online.match.player.maxHp}
            />

            {/* Keep forfeit available even while round-end overlay is shown */}
            {online.phase === 'round_end' && (
              <>
                <button
                  onClick={() => setShowOnlineRoundEndForfeitDialog(true)}
                  className="fixed top-4 left-4 z-[70] px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors"
                >
                  ✕ Forfeit
                </button>
                <ForfeitConfirmDialog
                  isOpen={showOnlineRoundEndForfeitDialog}
                  onCancel={() => setShowOnlineRoundEndForfeitDialog(false)}
                  onConfirm={() => {
                    setShowOnlineRoundEndForfeitDialog(false);
                    handleOnlineForfeit();
                  }}
                />
              </>
            )}

            {/* Latency indicator */}
            {online.latency && (
              <div className="fixed top-4 right-4 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card/80 border border-border text-xs font-mono text-muted-foreground backdrop-blur-sm">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    online.latency.smoothedRtt < 80 ? 'bg-hp-full' :
                    online.latency.smoothedRtt < 150 ? 'bg-yellow-500' : 'bg-damage',
                  )}
                />
                {Math.round(online.latency.smoothedRtt)}ms
                {online.latency.jitter > 15 && (
                  <span className="text-yellow-500 ml-1">±{Math.round(online.latency.jitter)}</span>
                )}
              </div>
            )}
          </>
        )}

        {/* Reconnecting overlay */}
        <AnimatePresence>
          {online.phase === 'reconnecting' && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-sm p-6 rounded-2xl border border-yellow-500/50 bg-card shadow-2xl space-y-4 text-center"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
              >
                <div className="flex justify-center">
                  <motion.div
                    className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  />
                </div>
                <div className="text-lg font-bold text-yellow-500">
                  Reconnecting...
                </div>
                <div className="text-sm text-muted-foreground">
                  Attempt {online.reconnectAttempt} of 10
                </div>
                <div className="text-xs text-muted-foreground">
                  Your match will resume once reconnected
                </div>
                <button
                  onClick={() => { online.resetMatch(); setPlayMode('offline'); }}
                  className="mt-2 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors"
                >
                  Leave Match
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Complete */}
        {online.phase === 'complete' && online.matchResult && (
          <OnlineResultsScreen
            matchResult={online.matchResult}
            match={online.match}
            opponent={online.opponent}
            onBackToMenu={() => {
              // Store last match for lobby sidebar
              setLastMatchData({
                wpm: online.matchResult!.myResult.wpm,
                accuracy: online.matchResult!.myResult.accuracy,
                result: online.matchResult!.myResult.result as 'win' | 'loss' | 'draw',
              });
              online.resetMatch();
              void auth.refreshProfile();
              setPlayMode('offline');
            }}
          />
        )}

        {/* Error display */}
        {online.error && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm">
            {online.error}
          </div>
        )}

        <PlayModeSelect
          isVisible={showModeSelect}
          isAuthenticated={auth.isAuthenticated}
          username={auth.user?.username}
          rating={auth.user?.rating ?? null}
          isCompetitiveQueueing={online.phase === 'queuing'}
          competitiveQueueTime={online.queueTime}
          isBotQueueing={offline.phase === 'queue'}
          botQueueTime={offline.queueTime}
          onStartCompetitiveQueue={startOnlineQueue}
          onCancelCompetitiveQueue={cancelCompetitiveQueue}
          onStartBotQueue={startOfflineQueue}
          onCancelBotQueue={cancelBotQueue}
          onStartFreeType={startPractice}
          onBack={closeModeSelect}
          onLogin={() => setShowAuth(true)}
        />

        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          showFps={showFps}
          onShowFpsChange={setShowFps}
        />

        <FpsOverlay isVisible={showFps} />

        {showAuth && <AuthPanel auth={auth} onClose={() => { setShowAuth(false); setPlayMode('offline'); }} />}
      </div>
    );
  }

  // ---- PRACTICE MODE rendering (MonkeyType-style solo) ----
  if (playMode === 'practice') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Persistent exit button — always accessible, even during typing */}
        <div className="absolute top-4 left-4 z-30">
          <button
            onClick={() => {
              setPracticePhase('typing');
              setPracticeResults(null);
              setPracticeStarted(false);
              setPlayMode('offline');
            }}
            className="px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors"
          >
            ✕ Exit
          </button>
        </div>

        {/* Header — hidden during active typing for focus */}
        <AnimatePresence>
          {(!practiceStarted || practicePhase === 'results') && (
            <motion.div
              className="w-full max-w-4xl mx-auto pt-8 px-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-center mb-4">
                <h1 className="text-xl font-bold tracking-tight">
                  <span className="text-primary">Velo</span>
                  <span className="text-foreground">Type</span>
                </h1>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-16">
          <div className="w-full max-w-4xl space-y-8">
            {/* Settings bar — hidden once typing starts for focus */}
            <AnimatePresence>
              {practicePhase === 'typing' && !practiceStarted && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <TypingOptionsBar
                    punctuationEnabled={practicePunctuation}
                    timeLimit={practiceTimeLimit}
                    allowEndless
                    onTogglePunctuation={() => {
                      setPracticePunctuation((p) => !p);
                      const text = buildPracticeText(!practicePunctuation, practiceTimeLimit);
                      setPracticeText(text);
                      setPracticeKey((k) => k + 1);
                    }}
                    onTimeLimitChange={(seconds) => {
                      const next = ([0, 15, 30, 60, 120].includes(seconds) ? seconds : 30) as 0 | 15 | 30 | 60 | 120;
                      setPracticeTimeLimit(next);
                      const text = buildPracticeText(practicePunctuation, next);
                      setPracticeText(text);
                      setPracticeKey((k) => k + 1);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {practicePhase === 'typing' && (
                <motion.div
                  key={`typing-${practiceKey}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  onKeyDown={() => {
                    if (!practiceStarted) setPracticeStarted(true);
                  }}
                >
                  <TypingArena
                    key={practiceKey}
                    text={practiceText}
                    isActive={true}
                    mode={isPracticeEndless ? 'text' : 'time'}
                    timeLimit={practiceRoundSeconds}
                    startOnFirstKeystroke={!isPracticeEndless}
                    onComplete={handlePracticeComplete}
                    focusMode
                  />
                </motion.div>
              )}

              {practicePhase === 'results' && practiceResults && (
                <motion.div
                  key="results"
                  className="space-y-10"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Hero stats — WPM + Accuracy large */}
                  <div className="flex items-end justify-center gap-16">
                    <div className="text-center">
                      <div className="text-base text-muted-foreground mb-1">wpm</div>
                      <div className="text-7xl md:text-8xl font-bold font-mono text-primary">
                        {Math.round(practiceResults.wpm)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-base text-muted-foreground mb-1">accuracy</div>
                      <div className="text-7xl md:text-8xl font-bold font-mono text-primary">
                        {Math.round(practiceResults.accuracy * 100)}%
                      </div>
                    </div>
                  </div>

                  {/* WPM over time chart */}
                  {practiceResults.wpmHistory && practiceResults.wpmHistory.length > 1 && (
                    <motion.div
                      className="rounded-xl border border-border bg-card/50 p-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.15 }}
                    >
                      <WpmChart data={practiceResults.wpmHistory} className="h-[240px]" />
                    </motion.div>
                  )}

                  {/* Secondary stats row */}
                  <div className="flex items-center justify-center gap-10 text-center">
                    <div>
                      <div className="text-sm text-muted-foreground">test type</div>
                      <div className="text-base font-mono font-semibold text-foreground">
                        {isPracticeEndless ? 'endless' : `time ${practiceTimeLimit}`}
                      </div>
                      <div className="text-sm text-muted-foreground">english</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">raw</div>
                      <div className="text-2xl font-mono font-semibold text-foreground">
                        {Math.round(practiceResults.rawWpm)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">characters</div>
                      <div className="text-2xl font-mono font-semibold text-foreground">
                        <span className="text-green-400">{practiceResults.correctCharacters}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-red-400">{practiceResults.errors}</span>
                        {(practiceResults.totalErrors ?? 0) > practiceResults.errors && (
                          <>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-yellow-400">{(practiceResults.totalErrors ?? 0) - practiceResults.errors}</span>
                          </>
                        )}
                      </div>
                      {(practiceResults.totalErrors ?? 0) > practiceResults.errors && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          <span className="text-yellow-400">{(practiceResults.totalErrors ?? 0) - practiceResults.errors}</span> corrected
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">consistency</div>
                      <div className="text-2xl font-mono font-semibold text-foreground">
                        {Math.round(practiceResults.consistency * 100)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">time</div>
                      <div className="text-2xl font-mono font-semibold text-foreground">
                        {isPracticeEndless ? '∞' : `${practiceTimeLimit}s`}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-center gap-4">
                    <motion.button
                      onClick={restartPractice}
                      className="px-10 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-xl"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Next Test
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Restart hint — hidden during active typing for focus */}
            {practicePhase === 'typing' && !practiceStarted && (
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

        <PlayModeSelect
          isVisible={showModeSelect}
          isAuthenticated={auth.isAuthenticated}
          username={auth.user?.username}
          rating={auth.user?.rating ?? null}
          isCompetitiveQueueing={online.phase === 'queuing'}
          competitiveQueueTime={online.queueTime}
          isBotQueueing={offline.phase === 'queue'}
          botQueueTime={offline.queueTime}
          onStartCompetitiveQueue={startOnlineQueue}
          onCancelCompetitiveQueue={cancelCompetitiveQueue}
          onStartBotQueue={startOfflineQueue}
          onCancelBotQueue={cancelBotQueue}
          onStartFreeType={startPractice}
          onBack={closeModeSelect}
          onLogin={() => setShowAuth(true)}
        />

        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          showFps={showFps}
          onShowFpsChange={setShowFps}
        />

        <FpsOverlay isVisible={showFps} />

        {showAuth && <AuthPanel auth={auth} onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  // ---- OFFLINE MODE rendering  // ---- OFFLINE MODE rendering (original simulated) ----
  return (
    <div className="min-h-screen bg-background">
      {/* Home with both play options */}
      {(offline.phase === 'home' || offline.phase === 'queue' || offline.phase === 'match_found') && (
        <HomeScreen
          username={auth.user?.username ?? 'Player'}
          rating={auth.user?.rating ?? null}
          isAuthenticated={auth.isAuthenticated}
          lastMatch={lastMatchData}
          onPlay={openModeSelect}
          onCareer={() => navigate('/profile')}
          onLeaderboard={() => navigate('/leaderboard')}
          onSettings={() => setShowSettings(true)}
          onLogin={() => setShowAuth(true)}
          onLogout={auth.logout}
        />
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
          isTypingActive={offline.phase === 'playing'}
          onForfeit={handleOfflineForfeit}
          confirmForfeit
        />
      )}

      {offline.phase === 'results' && offline.match && (
        <ResultsScreen
          match={offline.match}
          playerStats={getAggregateStats()}
          opponentStats={getOpponentAggregateStats()}
          eloChange={offline.getEloChange()}
          newRating={offline.playerRating}
          onBackToMenu={offline.playAgain}
        />
      )}

      {/* Overlays */}
      <QueueOverlay
        isVisible={offline.phase === 'queue' && !showModeSelect}
        onCancel={offline.cancelQueue}
        elapsedTime={offline.queueTime}
      />

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
        breakSeconds={7}
        playerName={offline.match?.player.username}
        opponentName={offline.match?.opponent.username}
        playerHp={offline.match?.player.hp}
        opponentHp={offline.match?.opponent.hp}
        maxHp={offline.match?.player.maxHp}
      />

      <PlayModeSelect
        isVisible={showModeSelect}
        isAuthenticated={auth.isAuthenticated}
        username={auth.user?.username}
        rating={auth.user?.rating ?? null}
        isCompetitiveQueueing={online.phase === 'queuing'}
        competitiveQueueTime={online.queueTime}
        isBotQueueing={offline.phase === 'queue'}
        botQueueTime={offline.queueTime}
        onStartCompetitiveQueue={startOnlineQueue}
        onCancelCompetitiveQueue={cancelCompetitiveQueue}
        onStartBotQueue={startOfflineQueue}
        onCancelBotQueue={cancelBotQueue}
        onStartFreeType={startPractice}
        onBack={closeModeSelect}
        onLogin={() => setShowAuth(true)}
      />

      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        showFps={showFps}
        onShowFpsChange={setShowFps}
      />

      <FpsOverlay isVisible={showFps} />

      {showAuth && <AuthPanel auth={auth} onClose={() => setShowAuth(false)} />}
    </div>
  );
};

export default Index;
