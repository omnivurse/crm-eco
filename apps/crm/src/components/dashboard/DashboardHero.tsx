'use client';

import { useState, useEffect } from 'react';
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
  onRefresh?: () => void;
}

export function DashboardHero({
  profile,
  todaysTaskCount,
  overdueCount,
  newThisWeek,
  atRiskCount,
  onRefresh,
}: DashboardHeroProps) {
  const [mounted, setMounted] = useState(false);
  const [dateInfo, setDateInfo] = useState({ greeting: 'Hello', formattedDate: '' });

  useEffect(() => {
    const currentHour = new Date().getHours();
    const greeting =
      currentHour < 12
        ? 'Good morning'
        : currentHour < 17
        ? 'Good afternoon'
        : 'Good evening';
    const formattedDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    setDateInfo({ greeting, formattedDate });
    setMounted(true);
  }, []);

  const firstName = profile.full_name?.split(' ')[0] || 'there';

  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#003560] via-[#004a7c] to-[#047474] p-4 sm:p-6 lg:p-8 shadow-[0_20px_50px_-12px_rgba(0,53,96,0.4)]">
      {/* Static background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-[#047474]/30 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-gradient-to-tr from-[#E9B61F]/20 to-transparent rounded-full blur-3xl" />
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
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap">
              <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] sm:text-xs font-medium text-white/80">
                  CRM Online
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#047474]/30 backdrop-blur-sm border border-[#047474]/40">
                <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#069B9A]" />
                <span className="text-[10px] sm:text-xs font-medium text-[#069B9A]">
                  Sales Hub
                </span>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">
              {dateInfo.greeting}, {firstName}!
            </h1>
            <p className="text-white/60 text-sm sm:text-lg">
              Here&apos;s what&apos;s happening with your CRM today
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white text-xs sm:text-sm font-medium transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
              <Clock className="w-4 h-4 text-white/60" />
              <span className="text-sm text-white/60">
                {mounted ? dateInfo.formattedDate : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Quick stats in header */}
        <div className="flex items-center gap-3 sm:gap-6 mt-4 sm:mt-8 pt-4 sm:pt-6 border-t border-white/10 overflow-x-auto pb-1">
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/20">
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-white">{todaysTaskCount}</p>
              <p className="text-[10px] sm:text-xs text-white/50">Tasks Today</p>
            </div>
          </div>
          {overdueCount > 0 && (
            <>
              <div className="w-px h-8 sm:h-12 bg-white/10 flex-shrink-0" />
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <div className="p-1.5 sm:p-2 rounded-lg bg-red-500/20">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-white">{overdueCount}</p>
                  <p className="text-[10px] sm:text-xs text-white/50">Overdue</p>
                </div>
              </div>
            </>
          )}
          <div className="w-px h-8 sm:h-12 bg-white/10 flex-shrink-0" />
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/20">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-white">{newThisWeek}</p>
              <p className="text-[10px] sm:text-xs text-white/50">New This Week</p>
            </div>
          </div>
          {atRiskCount > 0 && (
            <>
              <div className="w-px h-8 sm:h-12 bg-white/10 flex-shrink-0" />
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <div className="p-1.5 sm:p-2 rounded-lg bg-rose-500/20">
                  <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-white">{atRiskCount}</p>
                  <p className="text-[10px] sm:text-xs text-white/50">At Risk</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
