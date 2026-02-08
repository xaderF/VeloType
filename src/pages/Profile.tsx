import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CircleHelp, Gauge, Swords, Target, Timer } from 'lucide-react';
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
}

interface MatchEntry {
  matchId: string;
  createdAt: string;
  mode: string;
  limit: number;
  status: string;
  you: {
    wpm: number | null;
    accuracy: number | null;
    consistency: number | null;
    score: number | null;
    result: string | null;
    damageDealt: number | null;
    ratingDelta: number | null;
  };
  opponent: {
    username: string;
    rating: number | null;
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
      fetch(`${API_BASE}/matches?limit=20`, { headers }).then((r) => (r.ok ? r.json() : null)),
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
          <p className="text-muted-foreground">You need to be logged in to view your career.</p>
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
        <div className="text-muted-foreground animate-pulse">Loading career...</div>
      </div>
    );
  }

  const rating = user?.rating ?? null;
  const isPlacing = rating == null;
  const placementGames = Math.min(user?.placementGamesPlayed ?? 0, PLACEMENT_GAMES_REQUIRED);
  const placementRemaining = Math.max(PLACEMENT_GAMES_REQUIRED - placementGames, 0);
  const placementProgress = (placementGames / PLACEMENT_GAMES_REQUIRED) * 100;
  const recentMatches = matches.filter((m) => m.you.result != null).slice(0, 10);

  const rankInfo = rating != null ? getRankWithLeaderboard(rating) : null;
  const rankTier = rating != null && rankInfo ? getRankTier(rating, rankInfo.rank) : 0;
  const rankLabel = rankInfo ? `${rankInfo.name}${rankTier > 0 ? ` ${rankTier}` : ''}` : 'Unranked';

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back
          </Link>
          <Link to="/history" className="text-sm text-primary hover:underline">
            Full Match History →
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border bg-card/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="inline-flex w-full flex-wrap gap-2">
                <Badge variant="secondary" className="tracking-wide uppercase">Match History</Badge>
                <Badge variant="outline" className="tracking-wide uppercase">Act Rank</Badge>
                <Link to="/leaderboard">
                  <Badge variant="outline" className="tracking-wide uppercase hover:bg-secondary/70 transition-colors">
                    Leaderboard
                  </Badge>
                </Link>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-6">
              {isPlacing ? (
                <div className="rounded-xl border border-border/70 bg-background/40 p-6">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-16 h-16 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center">
                      <CircleHelp className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-wide">UNRANKED</h1>
                    <p className="text-sm text-muted-foreground max-w-xl">
                      Play {placementRemaining} more placement game{placementRemaining === 1 ? '' : 's'} to reveal your rank.
                    </p>
                    <div className="w-full max-w-md space-y-2 pt-1">
                      <Progress value={placementProgress} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Placement progress</span>
                        <span>{placementGames}/{PLACEMENT_GAMES_REQUIRED}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border/70 bg-background/40 p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                    <div className="flex items-center gap-4">
                      <RankBadge rating={rating} size="md" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{user?.username}</p>
                        <h1 className="text-2xl font-bold">{rankLabel}</h1>
                        <p className="text-sm text-muted-foreground">Hidden MMR: {rating}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Badge variant="secondary" className="justify-center">Ranked Active</Badge>
                      <Badge variant="outline" className="justify-center">Placement Complete</Badge>
                    </div>
                  </div>
                </div>
              )}

              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <StatCard label="Matches" value={stats.totalMatches} icon={<Swords className="w-4 h-4" />} />
                  <StatCard label="Win Rate" value={`${stats.winRate}%`} icon={<Target className="w-4 h-4" />} />
                  <StatCard label="Avg WPM" value={stats.avgWpm} subtext={`Best ${stats.bestWpm}`} icon={<Gauge className="w-4 h-4" />} />
                  <StatCard label="Accuracy" value={`${Math.round(stats.avgAccuracy * 100)}%`} subtext={`Cons ${Math.round(stats.avgConsistency * 100)}%`} icon={<Timer className="w-4 h-4" />} />
                  <StatCard label="Record" value={`${stats.wins}-${stats.losses}-${stats.draws}`} className="col-span-2 md:col-span-1" />
                </div>
              )}

              <Separator />

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base uppercase tracking-wide">Recent Match History</CardTitle>
                  <Badge variant="outline">{recentMatches.length} shown</Badge>
                </div>

                {recentMatches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No completed ranked matches yet. Finish your placement games to reveal your rank.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[460px] overflow-auto pr-1">
                    {recentMatches.map((match) => (
                      <MatchRow key={match.matchId} match={match} />
                    ))}
                  </div>
                )}
              </section>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  icon,
  className,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('border-border bg-card/60', className)}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs uppercase tracking-wide">{label}</span>
        </div>
        <div className="text-xl font-semibold">{value}</div>
        {subtext && <div className="text-xs text-muted-foreground mt-0.5">{subtext}</div>}
      </CardContent>
    </Card>
  );
}

function MatchRow({ match }: { match: MatchEntry }) {
  const result = match.you.result;
  const opponentName = match.opponent?.username ?? 'Unknown';
  const date = new Date(match.createdAt);

  const resultLabel = result === 'win' ? 'VICTORY' : result === 'loss' ? 'DEFEAT' : 'DRAW';
  const resultTone = result === 'win'
    ? 'border-emerald-500/30 bg-emerald-500/[0.08]'
    : result === 'loss'
      ? 'border-rose-500/30 bg-rose-500/[0.08]'
      : 'border-border bg-secondary/30';
  const resultTextTone = result === 'win'
    ? 'text-emerald-300'
    : result === 'loss'
      ? 'text-rose-300'
      : 'text-muted-foreground';

  return (
    <Link to={`/history/${match.matchId}`} className="block">
      <div className={cn('rounded-lg border p-3 transition-colors hover:bg-secondary/60', resultTone)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-sm font-semibold uppercase">
              {opponentName.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">vs {opponentName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' • '}
                {match.limit}s {match.mode}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className={cn('text-sm font-semibold tracking-wide', resultTextTone)}>{resultLabel}</p>
            {match.you.ratingDelta != null && (
              <p className={cn(
                'text-xs font-mono',
                match.you.ratingDelta > 0 && 'text-emerald-300',
                match.you.ratingDelta < 0 && 'text-rose-300',
                match.you.ratingDelta === 0 && 'text-muted-foreground',
              )}
              >
                {match.you.ratingDelta > 0 ? '+' : ''}
                {match.you.ratingDelta}
              </p>
            )}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <MetricChip label="WPM" value={match.you.wpm != null ? Math.round(match.you.wpm) : '-'} />
          <MetricChip label="ACC" value={match.you.accuracy != null ? `${Math.round(match.you.accuracy * 100)}%` : '-'} />
          <MetricChip label="CONS" value={match.you.consistency != null ? `${Math.round(match.you.consistency * 100)}%` : '-'} />
          <MetricChip label="DMG" value={match.you.damageDealt != null ? Math.round(match.you.damageDealt) : '-'} />
        </div>
      </div>
    </Link>
  );
}

function MetricChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-background/60 border border-border/60 px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-2 font-mono">{value}</span>
    </div>
  );
}
