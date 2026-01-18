import {
  Sun,
  AlertTriangle,
  TrendingUp,
  Flame,
  Target,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import type { CrmProfile, ModuleStats } from '@/lib/crm/types';

interface DashboardHeroProps {
  profile: CrmProfile;
  todaysTaskCount: number;
  overdueCount: number;
  newThisWeek: number;
  atRiskCount: number;
}

export function DashboardHero({
  profile,
  todaysTaskCount,
  overdueCount,
  newThisWeek,
  atRiskCount,
}: DashboardHeroProps) {
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? 'Good morning'
      : currentHour < 17
      ? 'Good afternoon'
      : 'Good evening';
  const firstName = profile.full_name?.split(' ')[0] || 'there';

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#003560] via-[#004a7c] to-[#047474] p-8 shadow-[0_20px_50px_-12px_rgba(0,53,96,0.4)]">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-[#047474]/30 to-transparent rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute -bottom-24 -left-24 w-96 h-96 bg-gradient-to-tr from-[#E9B61F]/20 to-transparent rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-white/5 to-transparent rounded-full" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]">
        <svg
          className="w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern
              id="heroGrid"
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 5 0 L 0 0 0 5"
                fill="none"
                stroke="white"
                strokeWidth="0.3"
              />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#heroGrid)" />
        </svg>
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-white/80">
                  CRM Online
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#047474]/30 backdrop-blur-sm border border-[#047474]/40">
                <Target className="w-3.5 h-3.5 text-[#069B9A]" />
                <span className="text-xs font-medium text-[#069B9A]">
                  Sales Hub
                </span>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {greeting}, {firstName}!
            </h1>
            <p className="text-white/60 text-lg">
              Here&apos;s what&apos;s happening with your CRM today
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white text-sm font-medium transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
              <Clock className="w-4 h-4 text-white/60" />
              <span className="text-sm text-white/60">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Quick stats in header */}
        <div className="flex items-center gap-6 mt-8 pt-6 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Sun className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{todaysTaskCount}</p>
              <p className="text-xs text-white/50">Tasks Today</p>
            </div>
          </div>
          {overdueCount > 0 && (
            <>
              <div className="w-px h-12 bg-white/10" />
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{overdueCount}</p>
                  <p className="text-xs text-white/50">Overdue</p>
                </div>
              </div>
            </>
          )}
          <div className="w-px h-12 bg-white/10" />
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{newThisWeek}</p>
              <p className="text-xs text-white/50">New This Week</p>
            </div>
          </div>
          {atRiskCount > 0 && (
            <>
              <div className="w-px h-12 bg-white/10" />
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500/20">
                  <Flame className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{atRiskCount}</p>
                  <p className="text-xs text-white/50">At Risk</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
