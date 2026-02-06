'use client';

import { Activity, TrendingUp, TrendingDown, Users, UserMinus, BarChart3, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@crm-eco/ui';

export interface MemberActivityData {
  newEnrollmentsThisMonth: number;
  inactiveMembersThisMonth: number;
  netGrowth: number;
  retentionRate: number;
  previousMonthEnrollments: number;
  previousMonthInactive: number;
}

interface MemberActivityAnalysisProps {
  data: MemberActivityData;
}

export function MemberActivityAnalysis({ data }: MemberActivityAnalysisProps) {
  const {
    newEnrollmentsThisMonth,
    inactiveMembersThisMonth,
    netGrowth,
    retentionRate,
    previousMonthEnrollments,
    previousMonthInactive,
  } = data;

  const enrollmentChange = previousMonthEnrollments > 0
    ? Math.round(((newEnrollmentsThisMonth - previousMonthEnrollments) / previousMonthEnrollments) * 100)
    : 0;

  const inactiveChange = previousMonthInactive > 0
    ? Math.round(((inactiveMembersThisMonth - previousMonthInactive) / previousMonthInactive) * 100)
    : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]">
      {/* Gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Member Activity</h3>
              <p className="text-sm text-slate-500">Monthly analysis</p>
            </div>
          </div>
          <Link
            href="/reports/members"
            className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            Full report
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="p-6">
        {/* Main metrics grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* New Enrollments */}
          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-emerald-100">
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-xs font-semibold text-emerald-700">New Enrollments</span>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold text-emerald-700">{newEnrollmentsThisMonth}</p>
              {enrollmentChange !== 0 && (
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                  enrollmentChange > 0 
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                )}>
                  {enrollmentChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {enrollmentChange > 0 ? '+' : ''}{enrollmentChange}%
                </span>
              )}
            </div>
            <p className="text-xs text-emerald-600 mt-1">This month</p>
          </div>

          {/* Inactive Members */}
          <div className="p-4 rounded-xl bg-red-50/50 border border-red-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-red-100">
                <UserMinus className="w-4 h-4 text-red-600" />
              </div>
              <span className="text-xs font-semibold text-red-700">Inactive Members</span>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold text-red-700">{inactiveMembersThisMonth}</p>
              {inactiveChange !== 0 && (
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                  inactiveChange < 0 
                    ? 'bg-emerald-100 text-emerald-700'  // Fewer inactive is good
                    : 'bg-red-100 text-red-700'
                )}>
                  {inactiveChange < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  {inactiveChange > 0 ? '+' : ''}{inactiveChange}%
                </span>
              )}
            </div>
            <p className="text-xs text-red-600 mt-1">This month</p>
          </div>
        </div>

        {/* Net Growth and Retention */}
        <div className="grid grid-cols-2 gap-4">
          {/* Net Growth */}
          <div className={cn(
            'p-4 rounded-xl border',
            netGrowth >= 0 
              ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
              : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200'
          )}>
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className={cn('w-4 h-4', netGrowth >= 0 ? 'text-emerald-600' : 'text-red-600')} />
              <span className="text-xs font-semibold text-slate-600">Net Growth</span>
            </div>
            <div className="flex items-center gap-2">
              <p className={cn(
                'text-2xl font-bold',
                netGrowth >= 0 ? 'text-emerald-700' : 'text-red-700'
              )}>
                {netGrowth >= 0 ? '+' : ''}{netGrowth}
              </p>
              {netGrowth >= 0 ? (
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-500" />
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">New - Inactive</p>
          </div>

          {/* Retention Rate */}
          <div className={cn(
            'p-4 rounded-xl border',
            retentionRate >= 90 
              ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200'
              : retentionRate >= 75
                ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200'
                : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200'
          )}>
            <div className="flex items-center gap-2 mb-2">
              <Activity className={cn(
                'w-4 h-4',
                retentionRate >= 90 ? 'text-emerald-600' : retentionRate >= 75 ? 'text-amber-600' : 'text-red-600'
              )} />
              <span className="text-xs font-semibold text-slate-600">Retention Rate</span>
            </div>
            <div className="flex items-center gap-2">
              <p className={cn(
                'text-2xl font-bold',
                retentionRate >= 90 ? 'text-emerald-700' : retentionRate >= 75 ? 'text-amber-700' : 'text-red-700'
              )}>
                {retentionRate}%
              </p>
              <div className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                retentionRate >= 90 
                  ? 'bg-emerald-100 text-emerald-700'
                  : retentionRate >= 75
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
              )}>
                {retentionRate >= 90 ? 'Excellent' : retentionRate >= 75 ? 'Good' : 'Needs Attention'}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Active / Total</p>
          </div>
        </div>
      </div>
    </div>
  );
}
