'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { Lock, KeyRound, AlertTriangle } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { toast } from 'sonner';

interface SessionLockProps {
    userName: string;
    userEmail: string;
    onUnlock: () => void;
    timeoutMinutes?: number;
}

/**
 * Session Lock Screen Component
 * 
 * Displayed when session times out due to inactivity.
 * User must re-enter password to continue.
 */
export function SessionLock({
    userName,
    userEmail,
    onUnlock,
    timeoutMinutes = 30
}: SessionLockProps) {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attempts, setAttempts] = useState(0);

    const MAX_ATTEMPTS = 5;

    const handleUnlock = useCallback(async () => {
        if (!password) {
            setError('Please enter your password');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const supabase = createClient();

            // Re-authenticate with password
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: userEmail,
                password,
            });

            if (authError) {
                setAttempts(prev => prev + 1);

                if (attempts + 1 >= MAX_ATTEMPTS) {
                    // Too many failed attempts - force full logout
                    await supabase.auth.signOut();
                    toast.error('Too many failed attempts. Please sign in again.');
                    router.push('/crm-login');
                    return;
                }

                setError(`Incorrect password. ${MAX_ATTEMPTS - attempts - 1} attempts remaining.`);
                setPassword('');
                return;
            }

            // Success - unlock session
            toast.success('Session unlocked');
            onUnlock();
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [password, userEmail, attempts, router, onUnlock]);

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/crm-login');
    };

    // Handle Enter key
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isLoading) {
            handleUnlock();
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center">
            <div className="w-full max-w-md p-8">
                {/* Lock Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                        <Lock className="w-10 h-10 text-white" />
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-white text-center mb-2">
                    Session Locked
                </h1>
                <p className="text-slate-400 text-center mb-6">
                    Your session was locked after {timeoutMinutes} minutes of inactivity
                </p>

                {/* User Info */}
                <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700">
                    <p className="text-white font-medium">{userName}</p>
                    <p className="text-slate-400 text-sm">{userEmail}</p>
                </div>

                {/* Password Input */}
                <div className="space-y-4">
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <Input
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="pl-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                            disabled={isLoading}
                            autoFocus
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {/* Buttons */}
                    <Button
                        onClick={handleUnlock}
                        disabled={isLoading || !password}
                        className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400"
                    >
                        {isLoading ? 'Unlocking...' : 'Unlock Session'}
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={handleSignOut}
                        className="w-full text-slate-400 hover:text-white"
                    >
                        Sign out
                    </Button>
                </div>

                {/* HIPAA Notice */}
                <p className="text-slate-500 text-xs text-center mt-6">
                    For security and HIPAA compliance, sessions are automatically locked
                    after {timeoutMinutes} minutes of inactivity.
                </p>
            </div>
        </div>
    );
}

/**
 * Hook to monitor session activity and trigger lock
 */
export function useSessionTimeout(timeoutMs: number = 30 * 60 * 1000) {
    const [isLocked, setIsLocked] = useState(false);
    const [lastActivity, setLastActivity] = useState(Date.now());

    // Update activity on user interaction
    const updateActivity = useCallback(() => {
        setLastActivity(Date.now());
        if (isLocked) {
            // Don't unlock automatically - require password
        }
    }, [isLocked]);

    // Check for timeout periodically
    useEffect(() => {
        const checkTimeout = () => {
            if (Date.now() - lastActivity > timeoutMs) {
                setIsLocked(true);
            }
        };

        const interval = setInterval(checkTimeout, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [lastActivity, timeoutMs]);

    // Track user activity
    useEffect(() => {
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];

        events.forEach(event => {
            window.addEventListener(event, updateActivity);
        });

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, updateActivity);
            });
        };
    }, [updateActivity]);

    const unlock = useCallback(() => {
        setIsLocked(false);
        setLastActivity(Date.now());
    }, []);

    return { isLocked, unlock, lastActivity };
}
