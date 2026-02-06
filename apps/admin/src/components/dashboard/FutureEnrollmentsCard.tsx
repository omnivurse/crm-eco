'use client';

import { CalendarClock, Users, ArrowRight, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';
import { differenceInDays, format } from 'date-fns';

export interface FutureEnrollmentsData {
  totalFutureActive: number;
  startingThisMonth: number;
  nextStartDate: string | null;
  upcomingEnrollments: {
    id: string;
    memberName: string;
    startDate: string;
    planName: string;
  }[];
}

interface FutureEnrollmentsCardProps {
  data: FutureEnrollmentsData;
}

export function FutureEnrollmentsCard({ data }: FutureEnrollmentsCardProps) {
  const { totalFutureActive, startingThisMonth, nextStartDate, upcomingEnrollments } = data;
  
  const daysUntilNext = nextStartDate 
    ? differenceInDays(new Date(nextStartDate), new Date())
    : null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]">
      {/* Gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
              <CalendarClock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Future Enrollments</h3>
              <p className="text-sm text-slate-500">Upcoming activations</p>
            </div>
          </div>
          <Link
            href="/enrollments?status=future_active"
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="p-6">
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 rounded-xl bg-blue-50/50 border border-blue-100">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-700">{totalFutureActive}</p>
            <p className="text-xs text-blue-600 font-medium">Total Future Active</p>
          </div>

          <div className="text-center p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold text-indigo-700">{startingThisMonth}</p>
            <p className="text-xs text-indigo-600 font-medium">Starting This Month</p>
          </div>

          <div className="text-center p-4 rounded-xl bg-purple-50/50 border border-purple-100">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-700">
              {daysUntilNext !== null ? daysUntilNext : '—'}
            </p>
            <p className="text-xs text-purple-600 font-medium">
              {daysUntilNext !== null ? 'Days to Next Start' : 'No Upcoming'}
            </p>
          </div>
        </div>

        {/* Next start date highlight */}
        {nextStartDate && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Next Activation Date</p>
                <p className="text-lg font-bold text-slate-900">
                  {format(new Date(nextStartDate), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white text-sm font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  {daysUntilNext === 0 
                    ? 'Today!' 
                    : daysUntilNext === 1 
                      ? 'Tomorrow' 
                      : `${daysUntilNext} days away`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming enrollments list */}
        {upcomingEnrollments.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Upcoming Activations
            </p>
            {upcomingEnrollments.slice(0, 4).map((enrollment) => (
              <Link
                key={enrollment.id}
                href={`/enrollments/${enrollment.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                    {enrollment.memberName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                      {enrollment.memberName}
                    </p>
                    <p className="text-xs text-slate-400">{enrollment.planName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-600">
                    {format(new Date(enrollment.startDate), 'MMM d')}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {differenceInDays(new Date(enrollment.startDate), new Date())} days
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
              <CalendarClock className="w-8 h-8 text-slate-300" />
            </div>
            <p className="font-medium text-slate-600 mb-1">No upcoming activations</p>
            <p className="text-sm text-slate-400">Future enrollments will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
