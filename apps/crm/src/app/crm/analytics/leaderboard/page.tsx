'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Medal,
  Crown,
  Flame,
  Zap,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Target,
  Users,
  Star,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@crm-eco/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LeaderboardEntry {
  advisor_id: string;
  first_name: string;
  last_name: string;
  email: string;
  commission_tier: string | null;
  rank_position: number;
  tier: string;
  production_score: number;
  total_commissions: number;
  total_enrollments: number;
  downline_production: number;
  growth_rate_pct: number;
  rank_change: number;
  streak_months: number;
  next_tier_gap: number;
}

interface MyRanking {
  ranked: boolean;
  rank_position?: number;
  total_ranked?: number;
  tier?: string;
  production_score?: number;
  total_commissions?: number;
  total_enrollments?: number;
  rank_change?: number;
  streak_months?: number;
  next_tier_gap?: number;
}

interface RankingsData {
  leaderboard: {
    leaderboard: LeaderboardEntry[];
    month: string;
    total_ranked: number;
  };
  myRanking: MyRanking;
}

interface Achievement {
  id: string;
  badge_key: string;
  badge_label: string;
  badge_description: string;
  tier_level: string;
  awarded_at: string;
  acknowledged_at: string | null;
}

interface AchievementsData {
  achievements: Achievement[];
  unacknowledged_count: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TIER_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: typeof Trophy; threshold: number }
> = {
  bronze: {
    label: 'Bronze',
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/30',
    icon: Medal,
    threshold: 0,
  },
  silver: {
    label: 'Silver',
    color: 'text-slate-600 dark:text-slate-300',
    bg: 'bg-slate-300/20 border-slate-400/30',
    icon: Medal,
    threshold: 500,
  },
  gold: {
    label: 'Gold',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
    icon: Trophy,
    threshold: 1500,
  },
  platinum: {
    label: 'Platinum',
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/30',
    icon: Crown,
    threshold: 3000,
  },
  elite: {
    label: 'Elite',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/30',
    icon: Flame,
    threshold: 5000,
  },
};

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'elite'];

const BADGE_ICONS: Record<string, typeof Star> = {
  top_producer: Trophy,
  rising_star: TrendingUp,
  streak_master: Flame,
  enrollment_king: Target,
  team_builder: Users,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function TierBadge({ tier, size = 'sm' }: { tier: string; size?: 'sm' | 'md' }) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  const Icon = config.icon;
  const sizeClasses =
    size === 'md'
      ? 'px-3 py-1 text-sm gap-1.5'
      : 'px-2 py-0.5 text-xs gap-1';
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold border ${config.bg} ${config.color} ${sizeClasses}`}
    >
      <Icon className={size === 'md' ? 'w-4 h-4' : 'w-3 h-3'} />
      {config.label}
    </span>
  );
}

function RankBadge({ position }: { position: number }) {
  if (position === 1) {
    return (
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold shadow-lg shadow-amber-500/25">
        <Trophy className="w-5 h-5" />
      </div>
    );
  }
  if (position === 2) {
    return (
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center text-white font-bold shadow-lg shadow-slate-500/25">
        <Medal className="w-5 h-5" />
      </div>
    );
  }
  if (position === 3) {
    return (
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold shadow-lg shadow-orange-500/25">
        <Medal className="w-5 h-5" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-sm">
      {position}
    </div>
  );
}

function TierProgressBar({
  currentTier,
  score,
  nextTierGap,
}: {
  currentTier: string;
  score: number;
  nextTierGap: number;
}) {
  const currentIdx = TIER_ORDER.indexOf(currentTier);
  if (currentIdx === -1 || currentIdx >= TIER_ORDER.length - 1) {
    // Already at elite
    return (
      <div className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400 font-semibold">
        <Flame className="w-4 h-4" />
        Max tier reached
      </div>
    );
  }

  const nextTier = TIER_ORDER[currentIdx + 1];
  const nextConfig = TIER_CONFIG[nextTier];
  const currentThreshold = TIER_CONFIG[currentTier]?.threshold ?? 0;
  const nextThreshold = nextConfig?.threshold ?? currentThreshold + 1;
  const range = nextThreshold - currentThreshold;
  const progress = range > 0 ? Math.min(((score - currentThreshold) / range) * 100, 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <TierBadge tier={currentTier} />
        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-500" />
          {Math.round(nextTierGap).toLocaleString()} pts to {nextConfig?.label}
        </span>
        <TierBadge tier={nextTier} />
      </div>
      <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
        {Math.round(score).toLocaleString()} / {nextThreshold.toLocaleString()} pts
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function LeaderboardPage() {
  const [rankings, setRankings] = useState<RankingsData | null>(null);
  const [achievements, setAchievements] = useState<AchievementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [capacityScope, setCapacityScope] = useState<string>('all');
  const [leaderboardMonth, setLeaderboardMonth] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      const rankParams = new URLSearchParams({ limit: '50' });
      if (capacityScope !== 'all') rankParams.set('capacity_scope', capacityScope);
      if (leaderboardMonth) rankParams.set('month', leaderboardMonth);

      const [rankRes, achRes] = await Promise.all([
        fetch(`/api/analytics/rankings?${rankParams}`),
        fetch('/api/analytics/achievements?limit=50'),
      ]);

      if (rankRes.ok) {
        setRankings(await rankRes.json());
      }
      if (achRes.ok) {
        setAchievements(await achRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard data:', error);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [capacityScope, leaderboardMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleAck(achievementId: string) {
    try {
      const res = await fetch(`/api/analytics/achievements/${achievementId}/ack`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Acknowledge failed');
      setAchievements((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          achievements: prev.achievements.map((a) =>
            a.id === achievementId ? { ...a, acknowledged_at: new Date().toISOString() } : a,
          ),
          unacknowledged_count: Math.max(0, prev.unacknowledged_count - 1),
        };
      });
    } catch {
      toast.error('Failed to acknowledge achievement');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  const myRanking = rankings?.myRanking;
  const leaderboard = rankings?.leaderboard?.leaderboard ?? [];
  const totalRanked = rankings?.leaderboard?.total_ranked ?? 0;
  const unacked = achievements?.achievements?.filter((a) => !a.acknowledged_at) ?? [];
  const allAchievements = achievements?.achievements ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-7 h-7 text-amber-500" />
            Leaderboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {totalRanked} advisors ranked
            {capacityScope !== 'all' && (
              <span>
                {' '}
                &middot;{' '}
                {capacityScope === 'health_insurance' ? 'Insurance' : 'Health Share'}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={capacityScope} onValueChange={setCapacityScope}>
            <SelectTrigger className="w-40 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Capacities</SelectItem>
              <SelectItem value="health_insurance">Insurance</SelectItem>
              <SelectItem value="health_share">Health Share</SelectItem>
            </SelectContent>
          </Select>
          <input
            type="month"
            value={leaderboardMonth ? leaderboardMonth.slice(0, 7) : ''}
            onChange={(e) => {
              const v = e.target.value;
              setLeaderboardMonth(v ? `${v}-01` : '');
            }}
            className="h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* My Ranking Card */}
      {myRanking?.ranked && (
        <Card className="glass-card border-slate-200 dark:border-white/10 bg-gradient-to-r from-amber-500/5 via-transparent to-violet-500/5 overflow-hidden">
          <CardContent className="pt-6 pb-5">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              {/* Rank position */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-amber-500/25">
                  #{myRanking.rank_position}
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Your Rank</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {myRanking.tier && <TierBadge tier={myRanking.tier} size="md" />}
                    {(myRanking.rank_change ?? 0) !== 0 && (
                      <span
                        className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                          (myRanking.rank_change ?? 0) > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {(myRanking.rank_change ?? 0) > 0 ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        )}
                        {Math.abs(myRanking.rank_change ?? 0)} positions
                      </span>
                    )}
                    {(myRanking.streak_months ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-xs font-semibold text-orange-600 dark:text-orange-400">
                        <Flame className="w-3 h-3" />
                        {myRanking.streak_months}mo streak
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1" />

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {Math.round(myRanking.production_score || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Score</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(myRanking.total_commissions || 0)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Commissions</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {myRanking.total_enrollments || 0}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Enrollments</p>
                </div>
              </div>
            </div>

            {/* Tier progress */}
            {myRanking.tier && (myRanking.next_tier_gap ?? 0) > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-white/10">
                <TierProgressBar
                  currentTier={myRanking.tier}
                  score={myRanking.production_score || 0}
                  nextTierGap={myRanking.next_tier_gap || 0}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leaderboard Table */}
      {leaderboard.length > 0 ? (
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Top {Math.min(leaderboard.length, 50)} Advisors
            </CardTitle>
            <CardDescription>
              Ranked by production score for{' '}
              {leaderboardMonth
                ? new Date(leaderboardMonth).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })
                : 'this month'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Header row */}
            <div className="hidden md:grid md:grid-cols-[3rem_1fr_6rem_7rem_6rem_5rem] gap-4 px-3 pb-2 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-white/10">
              <span>Rank</span>
              <span>Advisor</span>
              <span className="text-right">Score</span>
              <span className="text-right">Commissions</span>
              <span className="text-right">Enrollments</span>
              <span className="text-right">Growth</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {leaderboard.map((entry) => {
                const isCurrentUser =
                  myRanking?.ranked &&
                  myRanking.rank_position === entry.rank_position;
                return (
                  <div
                    key={entry.advisor_id}
                    className={`flex items-center md:grid md:grid-cols-[3rem_1fr_6rem_7rem_6rem_5rem] gap-4 px-3 py-3 rounded-lg transition-colors ${
                      isCurrentUser
                        ? 'bg-amber-500/5 border border-amber-500/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex-shrink-0">
                      <RankBadge position={entry.rank_position} />
                    </div>

                    {/* Advisor info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                          {entry.first_name} {entry.last_name}
                          {isCurrentUser && (
                            <span className="ml-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              (You)
                            </span>
                          )}
                        </p>
                        <TierBadge tier={entry.tier} />
                        {entry.rank_change > 0 && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center">
                            <ArrowUpRight className="w-2.5 h-2.5" />+{entry.rank_change}
                          </span>
                        )}
                        {entry.rank_change < 0 && (
                          <span className="text-[10px] text-red-500 font-medium flex items-center">
                            <ArrowDownRight className="w-2.5 h-2.5" />
                            {entry.rank_change}
                          </span>
                        )}
                        {entry.streak_months > 0 && (
                          <span className="text-[10px] text-orange-500 flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" />
                            {entry.streak_months}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {entry.email}
                        {entry.commission_tier && ` \u00B7 ${entry.commission_tier}`}
                      </p>
                    </div>

                    {/* Score */}
                    <div className="text-right hidden md:block">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white">
                        {Math.round(entry.production_score).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400">pts</p>
                    </div>

                    {/* Commissions */}
                    <div className="text-right">
                      <p className="font-bold text-sm text-slate-900 dark:text-white">
                        {formatCurrency(entry.total_commissions)}
                      </p>
                      {entry.downline_production > 0 && (
                        <p className="text-[10px] text-violet-500">
                          +{formatCurrency(entry.downline_production)} downline
                        </p>
                      )}
                    </div>

                    {/* Enrollments */}
                    <div className="text-right hidden md:block">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white">
                        {entry.total_enrollments}
                      </p>
                    </div>

                    {/* Growth */}
                    <div className="text-right hidden md:block">
                      {entry.growth_rate_pct !== 0 ? (
                        <span
                          className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                            entry.growth_rate_pct > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {entry.growth_rate_pct > 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {Math.abs(entry.growth_rate_pct)}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">--</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current user shown below if not in visible list */}
            {myRanking?.ranked &&
              !leaderboard.some((e) => e.rank_position === myRanking.rank_position) && (
                <div className="mt-3 pt-3 border-t border-dashed border-slate-300 dark:border-white/10">
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Your position</p>
                  <div className="flex items-center gap-4 px-3 py-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                      #{myRanking.rank_position}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-slate-900 dark:text-white">
                          You
                        </p>
                        {myRanking.tier && <TierBadge tier={myRanking.tier} />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {Math.round(myRanking.production_score || 0).toLocaleString()} pts
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-slate-900 dark:text-white">
                        {formatCurrency(myRanking.total_commissions || 0)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {myRanking.total_enrollments || 0} enrollments
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="py-16 text-center">
            <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No Rankings Yet
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Rankings are calculated nightly from commission data. Once the ranking engine runs,
              the leaderboard will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Achievements Section */}
      {allAchievements.length > 0 && (
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Achievements
              {unacked.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-amber-500 text-white">
                  {unacked.length}
                </span>
              )}
            </CardTitle>
            <CardDescription>Badges earned through performance milestones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allAchievements.map((ach) => {
                const Icon = BADGE_ICONS[ach.badge_key] || Star;
                const isNew = !ach.acknowledged_at;
                const tierCfg = TIER_CONFIG[ach.tier_level] || TIER_CONFIG.bronze;
                return (
                  <div
                    key={ach.id}
                    className={`relative flex items-start gap-3 p-4 rounded-xl border transition-all ${
                      isNew
                        ? 'bg-amber-500/5 border-amber-500/30 ring-1 ring-amber-500/20'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10'
                    }`}
                  >
                    {isNew && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
                    <div
                      className={`p-2.5 rounded-xl border ${tierCfg.bg}`}
                    >
                      <Icon className={`w-5 h-5 ${tierCfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {ach.badge_label}
                        </p>
                        <TierBadge tier={ach.tier_level} />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {ach.badge_description}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                        {new Date(ach.awarded_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      {isNew && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-7 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400"
                          onClick={() => handleAck(ach.id)}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tier Guide */}
      <Card className="glass-card border-slate-200 dark:border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-900 dark:text-white text-base">
            Tier Guide
          </CardTitle>
          <CardDescription>Score thresholds for each tier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {TIER_ORDER.map((tier) => {
              const cfg = TIER_CONFIG[tier];
              const Icon = cfg.icon;
              return (
                <div
                  key={tier}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${cfg.bg}`}
                >
                  <Icon className={`w-5 h-5 ${cfg.color}`} />
                  <div>
                    <p className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {cfg.threshold === 0
                        ? 'Starting tier'
                        : `${cfg.threshold.toLocaleString()}+ pts`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
