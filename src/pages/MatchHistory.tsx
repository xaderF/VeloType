// MatchHistory.tsx — Full match history list with match detail view (WPM graph, stats)

import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { RankBadge } from '@/components/game-ui/RankBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MatchListEntry {
  matchId: string;
  createdAt: string;
  mode: string;
  limit: number;
  seed: string;
  you: {
    wpm: number | null;
    accuracy: number | null;
    consistency: number | null;
    score: number | null;
    result: string | null;
    damageDealt: number | null;
    damageTaken: number | null;
    rawWpm: number | null;
    errors: number | null;
    ratingBefore: number | null;
    ratingAfter: number | null;
    ratingDelta: number | null;
  };
  opponent: {
    username: string;
    rating: number | null;
    wpm: number | null;
    accuracy: number | null;
    result: string | null;
  } | null;
}

interface MatchDetailPlayer {
  userId: string;
  username: string;
  rating: number | null;
  wpm: number | null;
  accuracy: number | null;
  consistency: number | null;
  score: number | null;
  result: string | null;
  damageDealt: number | null;
  damageTaken: number | null;
  rawWpm: number | null;
  errors: number | null;
  correctChars: number | null;
  totalTyped: number | null;
  ratingBefore: number | null;
  ratingAfter: number | null;
  ratingDelta: number | null;
  progressSamples: number[] | null;
}

interface MatchDetail {
  id: string;
  seed: string;
  mode: string;
  limit: number;
  status: string;
  createdAt: string;
  players: MatchDetailPlayer[];
}

// ---------------------------------------------------------------------------
// Match History List
// ---------------------------------------------------------------------------

export function MatchHistoryList() {
  const { token, isAuthenticated } = useAuth();
  const [matches, setMatches] = useState<MatchListEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_BASE}/matches?limit=${limit}&offset=${offset}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setMatches(data.matches ?? []);
          setTotal(data.total ?? 0);
        }
      })
      .finally(() => setLoading(false));
  }, [token, offset]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Log in to view your match history.</p>
          <Link to="/" className="text-primary underline">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/profile" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Profile
          </Link>
          <h1 className="text-lg font-bold">Match History</h1>
          <span className="text-sm text-muted-foreground">{total} total</span>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground animate-pulse py-12">Loading...</div>
        ) : matches.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">No matches yet.</div>
        ) : (
          <motion.div className="space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {matches.map((match) => (
              <MatchRow key={match.matchId} match={match} />
            ))}
          </motion.div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-center gap-4 pt-4">
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
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match Detail View
// ---------------------------------------------------------------------------

export function MatchDetailView() {
  const { matchId } = useParams<{ matchId: string }>();
  const { token, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !matchId) return;
    fetch(`${API_BASE}/matches/${matchId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setMatch(data);
      })
      .finally(() => setLoading(false));
  }, [token, matchId]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Log in to view match details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground animate-pulse">Loading match...</div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Match not found.</p>
          <button onClick={() => navigate('/history')} className="text-primary underline">
            Back to History
          </button>
        </div>
      </div>
    );
  }

  const you = match.players.find((p) => p.userId === user?.id);
  const opponent = match.players.find((p) => p.userId !== user?.id);
  const date = new Date(match.createdAt);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/history')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </button>
          <span className="text-xs text-muted-foreground font-mono">
            {match.id.slice(0, 8)}
          </span>
        </div>

        {/* Match header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border bg-card/80">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {you?.result === 'win' ? '🎉 Victory' : you?.result === 'loss' ? '💀 Defeat' : '🤝 Draw'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' · '}
                    {match.mode} {match.limit}s
                  </p>
                </div>
                {you?.ratingDelta != null && (
                  <div className="text-right">
                    <div
                      className={cn(
                        'text-2xl font-bold',
                        you.ratingDelta > 0 && 'text-green-400',
                        you.ratingDelta < 0 && 'text-red-400',
                        you.ratingDelta === 0 && 'text-muted-foreground',
                      )}
                    >
                      {you.ratingDelta > 0 ? '+' : ''}{you.ratingDelta}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {you.ratingBefore} → {you.ratingAfter}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Player comparison */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {you && <PlayerStatsCard player={you} label="You" isWinner={you.result === 'win'} />}
          {opponent && <PlayerStatsCard player={opponent} label={opponent.username} isWinner={opponent.result === 'win'} />}
        </motion.div>

        {/* WPM Graph */}
        {(you?.progressSamples?.length || opponent?.progressSamples?.length) ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-border bg-card/80">
              <CardContent className="p-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">
                  Progress Over Time (typed chars)
                </h3>
                <WpmGraph
                  youSamples={you?.progressSamples ?? []}
                  opponentSamples={opponent?.progressSamples ?? []}
                  opponentName={opponent?.username ?? 'Opponent'}
                />
              </CardContent>
            </Card>
          </motion.div>
        ) : null}

        {/* Match meta */}
        <motion.div
          className="text-xs text-muted-foreground text-center space-x-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <span>Seed: {match.seed}</span>
          <span>Mode: {match.mode}</span>
          <span>Limit: {match.limit}s</span>
        </motion.div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MatchRow({ match }: { match: MatchListEntry }) {
  const result = match.you.result;
  const wpm = match.you.wpm;
  const acc = match.you.accuracy;
  const delta = match.you.ratingDelta;
  const oppName = match.opponent?.username ?? 'Unknown';
  const date = new Date(match.createdAt);

  return (
    <Link to={`/history/${match.matchId}`}>
      <div
        className={cn(
          'flex items-center justify-between p-3 rounded-lg border transition-colors',
          'hover:bg-secondary/50',
          result === 'win' && 'border-green-500/20 bg-green-500/5',
          result === 'loss' && 'border-red-500/20 bg-red-500/5',
          result === 'draw' && 'border-border bg-card/50',
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'text-xs font-bold uppercase px-2 py-0.5 rounded min-w-[3.5rem] text-center',
              result === 'win' && 'bg-green-500/20 text-green-400',
              result === 'loss' && 'bg-red-500/20 text-red-400',
              result === 'draw' && 'bg-muted text-muted-foreground',
            )}
          >
            {result ?? '?'}
          </span>
          <div>
            <span className="text-sm font-medium">vs {oppName}</span>
            {match.opponent?.rating != null && (
              <RankBadge rating={match.opponent.rating} size="sm" className="ml-2" />
            )}
            <div className="text-xs text-muted-foreground">
              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {wpm != null && <span className="font-mono">{Math.round(wpm)} WPM</span>}
          {acc != null && <span className="text-muted-foreground">{Math.round(acc * 100)}%</span>}
          {delta != null && (
            <span
              className={cn(
                'font-semibold min-w-[2.5rem] text-right',
                delta > 0 && 'text-green-400',
                delta < 0 && 'text-red-400',
                delta === 0 && 'text-muted-foreground',
              )}
            >
              {delta > 0 ? '+' : ''}{delta}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function PlayerStatsCard({
  player,
  label,
  isWinner,
}: {
  player: MatchDetailPlayer;
  label: string;
  isWinner: boolean;
}) {
  return (
    <Card
      className={cn(
        'border-border bg-card/60',
        isWinner && 'border-green-500/30',
      )}
    >
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{label}</span>
            {player.rating != null && <RankBadge rating={player.rating} size="sm" />}
          </div>
          <span
            className={cn(
              'text-xs font-bold uppercase px-2 py-0.5 rounded',
              player.result === 'win' && 'bg-green-500/20 text-green-400',
              player.result === 'loss' && 'bg-red-500/20 text-red-400',
              player.result === 'draw' && 'bg-muted text-muted-foreground',
            )}
          >
            {player.result}
          </span>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
          <StatRow label="WPM" value={player.wpm != null ? Math.round(player.wpm) : '—'} />
          <StatRow label="Raw WPM" value={player.rawWpm != null ? Math.round(player.rawWpm) : '—'} />
          <StatRow label="Accuracy" value={player.accuracy != null ? `${Math.round(player.accuracy * 100)}%` : '—'} />
          <StatRow label="Consistency" value={player.consistency != null ? `${Math.round(player.consistency * 100)}%` : '—'} />
          <StatRow label="Score" value={player.score != null ? Math.round(player.score) : '—'} />
          <StatRow label="Errors" value={player.errors ?? '—'} />
          <StatRow label="Damage Dealt" value={player.damageDealt != null ? Math.round(player.damageDealt) : '—'} />
          <StatRow label="Damage Taken" value={player.damageTaken != null ? Math.round(player.damageTaken) : '—'} />
        </div>
      </CardContent>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}

function WpmGraph({
  youSamples,
  opponentSamples,
  opponentName,
}: {
  youSamples: number[];
  opponentSamples: number[];
  opponentName: string;
}) {
  const maxLen = Math.max(youSamples.length, opponentSamples.length);
  const data = Array.from({ length: maxLen }, (_, i) => ({
    second: i + 1,
    you: youSamples[i] ?? null,
    opponent: opponentSamples[i] ?? null,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="second"
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          label={{ value: 'Second', position: 'bottom', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          label={{ value: 'Chars typed', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Line
          type="monotone"
          dataKey="you"
          name="You"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="opponent"
          name={opponentName}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={2}
          dot={false}
          connectNulls
          strokeDasharray="4 2"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
