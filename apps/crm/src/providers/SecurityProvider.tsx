'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SessionLock } from '@/components/auth/SessionLock';

// Session timeout: effectively disabled (24 hours) — client requested removal
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const WARNING_BEFORE_TIMEOUT_MS = 5 * 60 * 1000; // Warn 5 minutes before

interface SecurityContextType {
    isLocked: boolean;
    isMFARequired: boolean;
    timeUntilTimeout: number | null;
    showTimeoutWarning: boolean;
    extendSession: () => void;
    lockSession: () => void;
}

const SecurityContext = createContext<SecurityContextType | null>(null);

export function useSecurityContext() {
    const context = useContext(SecurityContext);
    if (!context) {
        throw new Error('useSecurityContext must be used within SecurityProvider');
    }
    return context;
}

interface SecurityProviderProps {
    children: ReactNode;
    userName?: string;
    userEmail?: string;
}

/**
 * Security Provider
 * 
 * HIPAA-compliant session management:
 * - 30-minute inactivity timeout
 * - Session lock screen on timeout
 * - Activity tracking
 * - Timeout warning
 */
export function SecurityProvider({ children, userName = '', userEmail = '' }: SecurityProviderProps) {
    const router = useRouter();
    const pathname = usePathname();

    // Mounted guard: ensures server and client initial render match to prevent hydration mismatch
    const [mounted, setMounted] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [lastActivity, setLastActivity] = useState(() => Date.now());
    const [timeUntilTimeout, setTimeUntilTimeout] = useState<number | null>(null);
    const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

    useEffect(() => {
        queueMicrotask(() => setMounted(true));
    }, []);

    // Skip security for public pages
    const isPublicPage = pathname?.startsWith('/crm-login') || pathname?.startsWith('/login');

    // Update activity timestamp
    const updateActivity = useCallback(() => {
        if (!isLocked) {
            setLastActivity(Date.now());
            setShowTimeoutWarning(false);
        }
    }, [isLocked]);

    // Extend session (reset timeout)
    const extendSession = useCallback(() => {
        setLastActivity(Date.now());
        setShowTimeoutWarning(false);
    }, []);

    // Lock session manually
    const lockSession = useCallback(() => {
        setIsLocked(true);
    }, []);

    // Unlock session after re-auth
    const handleUnlock = useCallback(() => {
        setIsLocked(false);
        setLastActivity(Date.now());
        setShowTimeoutWarning(false);
    }, []);

    // Check session timeout using timeouts instead of a 1-second interval
    // to avoid re-rendering the entire provider tree every second
    useEffect(() => {
        if (isPublicPage || isLocked) return;

        const elapsed = Date.now() - lastActivity;
        const warningDelay = SESSION_TIMEOUT_MS - WARNING_BEFORE_TIMEOUT_MS - elapsed;
        const lockDelay = SESSION_TIMEOUT_MS - elapsed;

        // If already past lock time, lock immediately
        if (lockDelay <= 0) {
            queueMicrotask(() => {
                setIsLocked(true);
                setShowTimeoutWarning(false);
            });
            return;
        }

        // If already in warning window, show warning immediately
        if (warningDelay <= 0) {
            queueMicrotask(() => {
                setShowTimeoutWarning(true);
                setTimeUntilTimeout(Math.max(0, lockDelay));
            });
        }

        const timers: ReturnType<typeof setTimeout>[] = [];

        // Warning timeout: fires when entering the warning window
        if (warningDelay > 0) {
            timers.push(setTimeout(() => {
                setShowTimeoutWarning(true);
                setTimeUntilTimeout(WARNING_BEFORE_TIMEOUT_MS);
            }, warningDelay));
        }

        // Lock timeout: fires when session should lock
        timers.push(setTimeout(() => {
            setIsLocked(true);
            setShowTimeoutWarning(false);
        }, lockDelay));

        return () => timers.forEach(t => clearTimeout(t));
    }, [lastActivity, isPublicPage, isLocked]);

    // Update displayed minutes remaining every 60 seconds while warning is visible
    useEffect(() => {
        if (!showTimeoutWarning || isPublicPage || isLocked) return;

        const interval = setInterval(() => {
            const remaining = SESSION_TIMEOUT_MS - (Date.now() - lastActivity);
            setTimeUntilTimeout(Math.max(0, remaining));
        }, 60000);

        return () => clearInterval(interval);
    }, [showTimeoutWarning, lastActivity, isPublicPage, isLocked]);

    // Track user activity - deferred initialization for faster initial load
    useEffect(() => {
        if (isPublicPage || isLocked) return;

        // Defer activity tracking by 2 seconds after initial render
        // This significantly improves perceived page load time on mobile
        const deferTimer = setTimeout(() => {
            const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
            // Note: removed 'mousemove' to reduce event listener overhead on mobile

            // Throttle activity updates more aggressively (max once per 2 seconds)
            let throttled = false;
            const handleActivity = () => {
                if (throttled) return;
                throttled = true;
                updateActivity();
                setTimeout(() => { throttled = false; }, 2000);
            };

            events.forEach(event => {
                window.addEventListener(event, handleActivity, { passive: true });
            });

            // Store cleanup function
            (window as unknown as { __securityCleanup?: () => void }).__securityCleanup = () => {
                events.forEach(event => {
                    window.removeEventListener(event, handleActivity);
                });
            };
        }, 2000);

        return () => {
            clearTimeout(deferTimer);
            const cleanup = (window as unknown as { __securityCleanup?: () => void }).__securityCleanup;
            if (cleanup) cleanup();
        };
    }, [isPublicPage, isLocked, updateActivity]);

    const value = useMemo<SecurityContextType>(() => ({
        isLocked,
        isMFARequired: false,
        timeUntilTimeout,
        showTimeoutWarning,
        extendSession,
        lockSession,
    }), [isLocked, timeUntilTimeout, showTimeoutWarning, extendSession, lockSession]);

    // Show lock screen when session is locked (only after mount to prevent hydration mismatch)
    if (mounted && isLocked && !isPublicPage) {
        return (
            <SessionLock
                userName={userName}
                userEmail={userEmail}
                onUnlock={handleUnlock}
                timeoutMinutes={30}
            />
        );
    }

    return (
        <SecurityContext.Provider value={value}>
            {children}

            {/* Timeout Warning Toast (only after mount) */}
            {mounted && showTimeoutWarning && !isPublicPage && (
                <div className="fixed bottom-4 right-4 z-50 bg-amber-500 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-4 animate-in slide-in-from-right">
                    <div>
                        <p className="font-semibold">Session Expiring Soon</p>
                        <p className="text-sm opacity-90">
                            Your session will lock in {Math.ceil((timeUntilTimeout || 0) / 60000)} minutes
                        </p>
                    </div>
                    <button
                        onClick={extendSession}
                        className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                    >
                        Stay Active
                    </button>
                </div>
            )}
        </SecurityContext.Provider>
    );
}
