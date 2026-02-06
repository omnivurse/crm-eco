'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Clock, Shield, Wifi, WifiOff, TrendingUp, AlertCircle, Users, UserCheck } from 'lucide-react';
import { format } from 'date-fns';

interface DashboardHeaderClientProps {
  greeting: string;
  stats: {
    activeEnrollments: number;
    pendingEnrollments: number;
    totalMembers: number;
    totalAgents: number;
  } | null;
}

export function DashboardHeaderClient({ greeting, stats }: DashboardHeaderClientProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isOnline, setIsOnline] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Update current time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Online/offline detection
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setLastUpdated(new Date());
    router.refresh();
    // Simulate minimum refresh time for UX
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#003560] via-[#004a7c] to-[#047474] p-4 sm:p-8 shadow-[0_20px_50px_-12px_rgba(0,53,96,0.4)]">
      {/* Static background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-[#047474]/30 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-gradient-to-tr from-[#E9B61F]/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-white/5 to-transparent rounded-full" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="heroGrid" width="5" height="5" patternUnits="userSpaceOnUse">
              <path d="M 5 0 L 0 0 0 5" fill="none" stroke="white" strokeWidth="0.3" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#heroGrid)" />
        </svg>
      </div>

      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
              {/* Live indicator */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm border ${
                isOnline 
                  ? 'bg-emerald-500/20 border-emerald-500/30' 
                  : 'bg-red-500/20 border-red-500/30'
              }`}>
                {isOnline ? (
                  <>
                    <div className="relative">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">Live</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <WifiOff className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs font-medium text-red-400">Offline</span>
                  </>
                )}
              </div>
              
              {/* Admin Access badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E9B61F]/20 backdrop-blur-sm border border-[#E9B61F]/30">
                <Shield className="w-3.5 h-3.5 text-[#E9B61F]" />
                <span className="text-xs font-medium text-[#E9B61F]">Admin Access</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{greeting}!</h1>
            <p className="text-white/60 text-base sm:text-lg">Welcome to your Admin Dashboard</p>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-3">
            {/* Refresh button */}
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
            </button>
            
            {/* Current time and last updated */}
            <div className="hidden lg:flex flex-col items-end gap-1 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-white/60" />
                <span className="text-sm font-medium text-white">
                  {format(currentTime, 'h:mm:ss a')}
                </span>
              </div>
              <span className="text-[10px] text-white/40">
                Updated {format(lastUpdated, 'MMM d, h:mm a')}
              </span>
            </div>
          </div>
        </div>

        {/* Quick stats in header - horizontally scrollable on mobile */}
        <div className="flex items-center gap-4 sm:gap-6 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-white/10 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <TrendingUp className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-white">{stats?.activeEnrollments ?? 0}</p>
              <p className="text-[10px] sm:text-xs text-white/50 whitespace-nowrap">Active Enrollments</p>
            </div>
          </div>
          <div className="w-px h-10 sm:h-12 bg-white/10 flex-shrink-0" />
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <AlertCircle className="w-4 sm:w-5 h-4 sm:h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-white">{stats?.pendingEnrollments ?? 0}</p>
              <p className="text-[10px] sm:text-xs text-white/50 whitespace-nowrap">Pending Review</p>
            </div>
          </div>
          <div className="w-px h-10 sm:h-12 bg-white/10 flex-shrink-0" />
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="p-2 rounded-lg bg-[#047474]/30">
              <Users className="w-4 sm:w-5 h-4 sm:h-5 text-[#069B9A]" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-white">{stats?.totalMembers ?? 0}</p>
              <p className="text-[10px] sm:text-xs text-white/50 whitespace-nowrap">Total Members</p>
            </div>
          </div>
          <div className="w-px h-10 sm:h-12 bg-white/10 flex-shrink-0" />
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <UserCheck className="w-4 sm:w-5 h-4 sm:h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-white">{stats?.totalAgents ?? 0}</p>
              <p className="text-[10px] sm:text-xs text-white/50 whitespace-nowrap">Active Agents</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
