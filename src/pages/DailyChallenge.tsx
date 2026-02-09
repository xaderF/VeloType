// DailyChallenge.tsx — Daily seeded typing challenge with leaderboard

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { RankBadge } from '@/components/game-ui/RankBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DailyInfo {
  date: string;
  nextResetAt: string;
  resetTimezone: string;
  seed: string;
  targetText: string;
  alreadyPlayed: boolean;
  myScore: { wpm: number; accuracy: number; score: number; rank: number } | null;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  rating: number | null;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  score: number;
  errors: number;
}

interface SubmitResult {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  score: number;
  errors: number;
  rank: number;
}

function formatResetCountdown(nextResetAt: string | undefined, nowMs: number): string {
  if (!nextResetAt) return '--:--:--';
  const targetMs = Date.parse(nextResetAt);
  if (!Number.isFinite(targetMs)) return '--:--:--';

  const diffSeconds = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatResetTimezoneLabel(timezone: string | undefined): string {
  if (!timezone) return 'ET';
  return timezone === 'America/New_York' ? 'ET' : timezone;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DailyChallenge() {
  const { token, isAuthenticated } = useAuth();
  const [daily, setDaily] = useState<DailyInfo | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [loading, setLoading] = useState(true);

  // Game state
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle');
  const [typed, setTyped] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keystroke-level error tracking (same as typing engine)
  const totalErrorsRef = useRef(0);
  const totalKeystrokesRef = useRef(0);

  // Fetch daily info + leaderboard
  const fetchData = useCallback(async () => {
    setLoading(true);
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const [dailyRes, lbRes] = await Promise.all([
        fetch(`${API_BASE}/daily`, { headers }),
        fetch(`${API_BASE}/daily/leaderboard`),
      ]);

      if (dailyRes.ok) {
        const data = await dailyRes.json();
        setDaily(data);
        if (data.alreadyPlayed) setPhase('done');
      }
      if (lbRes.ok) {
        const data = await lbRes.json();
        setLeaderboard(data.leaderboard ?? []);
        setTotalParticipants(data.totalParticipants ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Refresh as soon as the server-defined daily boundary passes.
  useEffect(() => {
    if (!daily?.nextResetAt) return;
    if (phase === 'playing') return;

    const nextResetMs = Date.parse(daily.nextResetAt);
    if (!Number.isFinite(nextResetMs)) return;

    const delayMs = Math.max(1000, nextResetMs - Date.now() + 1000);
    const timer = window.setTimeout(() => {
      void fetchData();
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [daily?.nextResetAt, fetchData, phase]);

  // Handle submission
  const finishChallenge = useCallback(async (finalTyped?: string) => {
    if (phase !== 'playing' || !token || !daily) return;
    const elapsed = Date.now() - startTime;
    const text = finalTyped ?? typed;
    setPhase('done');
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/daily/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          typed: text,
          elapsedMs: elapsed,
          totalErrors: totalErrorsRef.current,
          totalKeystrokes: totalKeystrokesRef.current,
        }),
      });

      if (res.ok) {
        const data: SubmitResult = await res.json();
        setResult(data);
        // Refresh leaderboard
        const lbRes = await fetch(`${API_BASE}/daily/leaderboard`);
        if (lbRes.ok) {
          const lbData = await lbRes.json();
          setLeaderboard(lbData.leaderboard ?? []);
          setTotalParticipants(lbData.totalParticipants ?? 0);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }, [phase, token, daily, startTime, typed]);

  // Handle typing
  const handleKeyDown = useCallback(
    (_e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!daily || phase !== 'playing') return;

      // Stop if they've typed the whole text
      if (typed.length >= daily.targetText.length) {
        finishChallenge();
      }
    },
    [daily, phase, typed, finishChallenge],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!daily || phase !== 'playing') return;
      const value = e.target.value;
      if (value.length > daily.targetText.length) return;

      // Track keystroke-level errors for accuracy
      if (value.length > typed.length) {
        // Forward typing (new character added)
        const newCharIdx = value.length - 1;
        totalKeystrokesRef.current += 1;
        if (value[newCharIdx] !== daily.targetText[newCharIdx]) {
          totalErrorsRef.current += 1;
        }
      }
      // Backspace doesn't affect totalErrors or totalKeystrokes (matches engine behavior)

      setTyped(value);

      // Auto-finish when they've typed enough
      if (value.length >= daily.targetText.length) {
        setTimeout(() => finishChallenge(value), 50);
      }
    },
    [daily, phase, typed, finishChallenge],
  );

  const startChallenge = () => {
    if (!daily || daily.alreadyPlayed) return;
    setPhase('playing');
    setTyped('');
    setStartTime(Date.now());
    totalErrorsRef.current = 0;
    totalKeystrokesRef.current = 0;
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground animate-pulse">Loading daily challenge...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Home
          </Link>
          <h1 className="text-lg font-bold">Daily Challenge</h1>
          <div className="text-right">
            <div className="text-sm text-muted-foreground font-mono">{daily?.date}</div>
            <div className="text-xs text-muted-foreground font-mono">
              resets in {formatResetCountdown(daily?.nextResetAt, nowMs)} {formatResetTimezoneLabel(daily?.resetTimezone)}
            </div>
          </div>
        </div>

        {/* Challenge area */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border bg-card/80">
            <CardContent className="p-6 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {phase === 'idle' && 'Type the text below as fast and accurately as you can'}
                  {phase === 'playing' && 'Go!'}
                  {phase === 'done' && (daily?.alreadyPlayed && !result ? 'Already submitted today' : 'Complete!')}
                </h2>
                {totalParticipants > 0 && (
                  <span className="text-xs text-muted-foreground">{totalParticipants} players today</span>
                )}
              </div>

              {/* Target text display */}
              {daily && (
                <div className="font-mono text-sm leading-relaxed p-4 rounded-lg bg-secondary/50 border border-border relative select-none">
                  {daily.targetText.split('').map((char, i) => {
                    let color = 'text-muted-foreground';
                    if (i < typed.length) {
                      color = typed[i] === char ? 'text-green-400' : 'text-red-400 bg-red-500/20';
                    } else if (i === typed.length && phase === 'playing') {
                      color = 'text-foreground bg-primary/20';
                    }
                    return (
                      <span key={i} className={color}>
                        {char}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Hidden input for typing */}
              {phase === 'playing' && (
                <textarea
                  ref={inputRef}
                  value={typed}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  className="opacity-0 absolute w-0 h-0"
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
              )}

              {/* Actions */}
              {phase === 'idle' && !daily?.alreadyPlayed && isAuthenticated && (
                <button
                  onClick={startChallenge}
                  className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity"
                >
                  Start Challenge
                </button>
              )}

              {phase === 'playing' && (
                <button
                  onClick={() => finishChallenge()}
                  className="w-full py-3 rounded-lg border border-border text-sm hover:bg-secondary/50 transition-colors"
                >
                  Finish Early
                </button>
              )}

              {!isAuthenticated && (
                <p className="text-sm text-muted-foreground text-center">
                  Log in to participate in the daily challenge.
                </p>
              )}

              {/* Result */}
              {(result || daily?.myScore) && (
                <motion.div
                  className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <MiniStat label="WPM" value={Math.round(result?.wpm ?? daily?.myScore?.wpm ?? 0)} />
                  <MiniStat
                    label="Accuracy"
                    value={`${Math.round((result?.accuracy ?? daily?.myScore?.accuracy ?? 0) * 100)}%`}
                  />
                  <MiniStat label="Score" value={Math.round(result?.score ?? daily?.myScore?.score ?? 0)} />
                  <MiniStat
                    label="Rank"
                    value={`#${result?.rank ?? daily?.myScore?.rank ?? '?'}`}
                    highlight
                  />
                </motion.div>
              )}

              {submitting && (
                <div className="text-center text-sm text-muted-foreground animate-pulse">Submitting...</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <Separator />

        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-lg font-semibold mb-4">Today's Leaderboard</h2>

          {leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No scores yet today. Be the first!
            </p>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-2 px-3 py-2 text-xs text-muted-foreground font-medium">
                <span>#</span>
                <span>Player</span>
                <span className="text-right">WPM</span>
                <span className="text-right">Acc</span>
                <span className="text-right">Score</span>
              </div>

              {leaderboard.map((entry, i) => (
                <div
                  key={entry.username}
                  className={cn(
                    'grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-2 px-3 py-2.5 rounded-lg text-sm items-center',
                    i === 0 && 'bg-yellow-500/10 border border-yellow-500/20',
                    i === 1 && 'bg-gray-300/10 border border-gray-300/20',
                    i === 2 && 'bg-orange-500/10 border border-orange-500/20',
                    i > 2 && 'hover:bg-secondary/30',
                  )}
                >
                  <span
                    className={cn(
                      'font-bold',
                      i === 0 && 'text-yellow-400',
                      i === 1 && 'text-gray-300',
                      i === 2 && 'text-orange-400',
                    )}
                  >
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : entry.rank}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{entry.username}</span>
                    {entry.rating != null && <RankBadge rating={entry.rating} size="sm" />}
                  </div>
                  <span className="text-right font-mono">{Math.round(entry.wpm)}</span>
                  <span className="text-right text-muted-foreground">
                    {Math.round(entry.accuracy * 100)}%
                  </span>
                  <span className="text-right font-mono font-semibold">
                    {Math.round(entry.score)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="text-center p-3 rounded-lg bg-secondary/50">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={cn('text-lg font-bold', highlight && 'text-primary')}>{value}</div>
    </div>
  );
}
