// Leaderboard.tsx — Main ELO leaderboard + daily challenge sidebar

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { RankBadge } from '@/components/game-ui/RankBadge';
import { LobbyPageShell } from '@/components/layout/LobbyPageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeaderboardPlayer {
  rank: number;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  avgWpm: number;
}

interface MyRank {
  rank: number;
  rating: number;
  username: string;
}

interface DailyInfo {
  date: string;
  nextResetAt: string;
  resetTimezone: string;
  alreadyPlayed: boolean;
  myScore: { wpm: number; accuracy: number; score: number; rank: number } | null;
}

interface DailyLeaderboardEntry {
  rank: number;
  username: string;
  wpm: number;
  accuracy: number;
  score: number;
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

export default function Leaderboard() {
  const { token } = useAuth();
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [myRank, setMyRank] = useState<MyRank | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const limit = 50;

  // Daily challenge mini-state
  const [daily, setDaily] = useState<DailyInfo | null>(null);
  const [dailyTop, setDailyTop] = useState<DailyLeaderboardEntry[]>([]);
  const [dailyTotal, setDailyTotal] = useState(0);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/leaderboard?limit=${limit}&offset=${offset}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.leaderboard ?? []);
        setTotal(data.total ?? 0);
        setMyRank(data.myRank ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [token, offset]);

  const fetchDaily = useCallback(async () => {
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const [dailyRes, lbRes] = await Promise.all([
        fetch(`${API_BASE}/daily`, { headers }),
        fetch(`${API_BASE}/daily/leaderboard?limit=5`),
      ]);
      if (dailyRes.ok) setDaily(await dailyRes.json());
      if (lbRes.ok) {
        const data = await lbRes.json();
        setDailyTop(data.leaderboard ?? []);
        setDailyTotal(data.totalParticipants ?? 0);
      }
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);
  useEffect(() => { fetchDaily(); }, [fetchDaily]);
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Keep the daily sidebar in sync with calendar-day reset while page stays open.
  useEffect(() => {
    if (!daily?.nextResetAt) return;
    const nextResetMs = Date.parse(daily.nextResetAt);
    if (!Number.isFinite(nextResetMs)) return;

    const delayMs = Math.max(1000, nextResetMs - Date.now() + 1000);
    const timer = window.setTimeout(() => {
      void fetchDaily();
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [daily?.nextResetAt, fetchDaily]);

  return (
    <LobbyPageShell contentClassName="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Home
          </Link>
          <h1 className="text-lg font-bold">Leaderboard</h1>
          <span className="text-sm text-muted-foreground">{total} ranked players</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* ── Main ELO Leaderboard ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {/* Your rank banner */}
            {myRank && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Your Rank</span>
                    <span className="text-xl font-bold text-primary">#{myRank.rank}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RankBadge rating={myRank.rating} size="sm" />
                    <span className="font-mono text-sm">{myRank.rating} MMR</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Table header */}
            <div className="grid grid-cols-[3rem_1fr_6rem_5rem_5rem_5rem] gap-2 px-4 py-2 text-xs text-muted-foreground font-medium">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Rating</span>
              <span className="text-right">W</span>
              <span className="text-right">L</span>
              <span className="text-right">Avg WPM</span>
            </div>

            {loading ? (
              <div className="text-center text-muted-foreground animate-pulse py-12">Loading...</div>
            ) : players.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">No ranked players yet.</div>
            ) : (
              <div className="space-y-1">
                {players.map((p, i) => (
                  <PlayerRow key={p.username} player={p} globalIndex={i} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="px-4 py-2 rounded-lg border text-sm disabled:opacity-30 hover:bg-secondary transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-sm text-muted-foreground">
                  {offset + 1}–{Math.min(offset + limit, total)} of {total}
                </span>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="px-4 py-2 rounded-lg border text-sm disabled:opacity-30 hover:bg-secondary transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </motion.div>

          {/* ── Sidebar: Daily Challenge ── */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-border bg-card/80">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Daily Challenge</h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {daily?.date ?? '—'}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground font-mono text-center">
                  resets in {formatResetCountdown(daily?.nextResetAt, nowMs)} {formatResetTimezoneLabel(daily?.resetTimezone)}
                </div>

                {daily?.alreadyPlayed && daily.myScore ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <MiniStat label="WPM" value={Math.round(daily.myScore.wpm)} />
                      <MiniStat label="Rank" value={`#${daily.myScore.rank}`} highlight />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">Come back tomorrow!</p>
                  </div>
                ) : (
                  <Link
                    to="/daily"
                    className="block w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-center text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Play Today's Challenge
                  </Link>
                )}

                {/* Top 5 daily scores */}
                {dailyTop.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium px-1">
                        <span>Today's Top {Math.min(5, dailyTotal)}</span>
                        <span>{dailyTotal} played</span>
                      </div>
                      {dailyTop.map((entry) => (
                        <div
                          key={entry.username}
                          className="flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-secondary/30"
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'font-bold w-5',
                              entry.rank === 1 && 'text-yellow-400',
                              entry.rank === 2 && 'text-gray-300',
                              entry.rank === 3 && 'text-orange-400',
                            )}>
                              {entry.rank <= 3
                                ? ['🥇', '🥈', '🥉'][entry.rank - 1]
                                : entry.rank}
                            </span>
                            <span className="truncate max-w-[7rem]">{entry.username}</span>
                          </div>
                          <span className="font-mono">{Math.round(entry.wpm)} wpm</span>
                        </div>
                      ))}
                      <Link
                        to="/daily"
                        className="block text-center text-[11px] text-primary hover:underline pt-1"
                      >
                        View full daily board →
                      </Link>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </LobbyPageShell>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlayerRow({ player, globalIndex }: { player: LeaderboardPlayer; globalIndex: number }) {
  const isTop3 = player.rank <= 3;
  return (
    <div
      className={cn(
        'grid grid-cols-[3rem_1fr_6rem_5rem_5rem_5rem] gap-2 px-4 py-3 rounded-lg text-sm items-center',
        isTop3 && player.rank === 1 && 'bg-yellow-500/10 border border-yellow-500/20',
        isTop3 && player.rank === 2 && 'bg-gray-300/10 border border-gray-300/20',
        isTop3 && player.rank === 3 && 'bg-orange-500/10 border border-orange-500/20',
        !isTop3 && 'hover:bg-secondary/30',
      )}
    >
      <span className={cn(
        'font-bold',
        player.rank === 1 && 'text-yellow-400',
        player.rank === 2 && 'text-gray-300',
        player.rank === 3 && 'text-orange-400',
      )}>
        {isTop3 ? ['🥇', '🥈', '🥉'][player.rank - 1] : player.rank}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium truncate">{player.username}</span>
        <RankBadge rating={player.rating} size="sm" />
      </div>
      <span className="text-right font-mono font-semibold">{player.rating}</span>
      <span className="text-right text-green-400">{player.wins}</span>
      <span className="text-right text-red-400">{player.losses}</span>
      <span className="text-right font-mono text-muted-foreground">{player.avgWpm}</span>
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="text-center p-2 rounded-lg bg-secondary/50">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn('text-sm font-bold', highlight && 'text-primary')}>{value}</div>
    </div>
  );
}
