// Profile.tsx — Player profile page with stats overview and recent match history

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { RankBadge } from '@/components/game-ui/RankBadge';
import { getRankWithLeaderboard, getRankTier, PLACEMENT_GAMES_REQUIRED } from '@/utils/scoring';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

interface ProfileStats {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgWpm: number;
  bestWpm: number;
  avgAccuracy: number;
  avgConsistency: number;
  recentRatings: { delta: number; date: string }[];
}

interface MatchEntry {
  matchId: string;
  createdAt: string;
  mode: string;
  limit: number;
  seed: string;
  you: {
    wpm: number | null;
    accuracy: number | null;
    result: string | null;
    ratingBefore: number | null;
    ratingAfter: number | null;
    ratingDelta: number | null;
  };
  opponent: {
    username: string;
    rating: number | null;
    wpm: number | null;
    result: string | null;
  } | null;
}

export default function Profile() {
  const { token, user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API_BASE}/profile/stats`, { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/matches?limit=10`, { headers }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([statsData, matchData]) => {
        if (statsData) setStats(statsData);
        if (matchData) setMatches(matchData.matches ?? []);
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">You need to be logged in to view your profile.</p>
          <Link to="/" className="text-primary underline">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground animate-pulse">Loading profile...</div>
      </div>
    );
  }

  const rating = user?.rating ?? null;
  const placementGames = user?.placementGamesPlayed ?? 0;
  const isPlacing = rating == null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header nav */}
        <div className="flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back
          </Link>
          <Link
            to="/history"
            className="text-sm text-primary hover:underline"
          >
            Full Match History →
          </Link>
        </div>

        {/* Player card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-4xl border-2 border-primary">
                  👤
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold">{user?.username}</h1>
                  {isPlacing ? (
                    <div className="space-y-1">
                      <Badge variant="secondary" className="text-sm">
                        Placement {placementGames}/{PLACEMENT_GAMES_REQUIRED}
                      </Badge>
                      <Progress
                        value={(placementGames / PLACEMENT_GAMES_REQUIRED) * 100}
                        className="h-1.5 w-32"
                      />
                    </div>
                  ) : (
                    <RankBadge rating={rating} size="md" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats grid */}
        {stats && (
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <StatCard label="Matches" value={stats.totalMatches} />
            <StatCard
              label="Win Rate"
              value={`${stats.winRate}%`}
              subtext={`${stats.wins}W / ${stats.losses}L / ${stats.draws}D`}
            />
            <StatCard
              label="Avg WPM"
              value={stats.avgWpm}
              subtext={`Best: ${stats.bestWpm}`}
            />
            <StatCard
              label="Avg Accuracy"
              value={`${Math.round(stats.avgAccuracy * 100)}%`}
              subtext={`Cons: ${Math.round(stats.avgConsistency * 100)}%`}
            />
          </motion.div>
        )}

        <Separator />

        {/* Recent matches */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-semibold mb-4">Recent Matches</h2>
          {matches.length === 0 ? (
            <p className="text-muted-foreground text-sm">No matches yet. Play ranked to get started!</p>
          ) : (
            <div className="space-y-2">
              {matches.map((match) => (
                <MatchRow key={match.matchId} match={match} />
              ))}
            </div>
          )}
          {matches.length > 0 && (
            <Link
              to="/history"
              className="block text-center text-sm text-primary hover:underline mt-4"
            >
              View all matches →
            </Link>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <Card className="border-border bg-card/60">
      <CardContent className="p-4 text-center">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {subtext && (
          <div className="text-xs text-muted-foreground/70 mt-0.5">{subtext}</div>
        )}
      </CardContent>
    </Card>
  );
}

function MatchRow({ match }: { match: MatchEntry }) {
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
              'text-xs font-bold uppercase px-2 py-0.5 rounded',
              result === 'win' && 'bg-green-500/20 text-green-400',
              result === 'loss' && 'bg-red-500/20 text-red-400',
              result === 'draw' && 'bg-muted text-muted-foreground',
            )}
          >
            {result ?? '?'}
          </span>
          <div>
            <span className="text-sm font-medium">vs {oppName}</span>
            <div className="text-xs text-muted-foreground">
              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {wpm != null && <span className="font-mono">{Math.round(wpm)} WPM</span>}
          {acc != null && (
            <span className="text-muted-foreground">{Math.round(acc * 100)}%</span>
          )}
          {delta != null && (
            <span
              className={cn(
                'font-semibold',
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
