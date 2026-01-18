'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { SessionLock } from '@/components/auth/SessionLock';

// Session timeout: 30 minutes of inactivity
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
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

    const [isLocked, setIsLocked] = useState(false);
    const [isMFARequired, setIsMFARequired] = useState(false);
    const [lastActivity, setLastActivity] = useState(Date.now());
    const [timeUntilTimeout, setTimeUntilTimeout] = useState<number | null>(null);
    const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

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

    // Check session timeout
    useEffect(() => {
        if (isPublicPage || isLocked) return;

        const interval = setInterval(() => {
            const elapsed = Date.now() - lastActivity;
            const remaining = SESSION_TIMEOUT_MS - elapsed;

            setTimeUntilTimeout(Math.max(0, remaining));

            // Show warning 5 minutes before timeout
            if (remaining <= WARNING_BEFORE_TIMEOUT_MS && remaining > 0) {
                setShowTimeoutWarning(true);
            }

            // Lock session on timeout
            if (remaining <= 0) {
                setIsLocked(true);
                setShowTimeoutWarning(false);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [lastActivity, isPublicPage, isLocked]);

    // Track user activity
    useEffect(() => {
        if (isPublicPage || isLocked) return;

        const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];

        // Throttle activity updates (max once per second)
        let throttled = false;
        const handleActivity = () => {
            if (throttled) return;
            throttled = true;
            updateActivity();
            setTimeout(() => { throttled = false; }, 1000);
        };

        events.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [isPublicPage, isLocked, updateActivity]);

    // Check MFA status on mount
    useEffect(() => {
        if (isPublicPage) return;

        const checkMFA = async () => {
            try {
                const supabase = createClient();
                const { data: factors } = await supabase.auth.mfa.listFactors();

                // If MFA is enrolled, check if verified
                if (factors?.totp && factors.totp.length > 0) {
                    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

                    // If current AAL is less than required, MFA is needed
                    if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
                        setIsMFARequired(true);
                    }
                }
            } catch (error) {
                console.error('Failed to check MFA status:', error);
            }
        };

        checkMFA();
    }, [isPublicPage]);

    const value: SecurityContextType = {
        isLocked,
        isMFARequired,
        timeUntilTimeout,
        showTimeoutWarning,
        extendSession,
        lockSession,
    };

    // Show lock screen when session is locked
    if (isLocked && !isPublicPage) {
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

            {/* Timeout Warning Toast */}
            {showTimeoutWarning && !isPublicPage && (
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
