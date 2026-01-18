'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { Shield, Smartphone, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { toast } from 'sonner';

interface MFAChallengeProps {
    onSuccess: () => void;
    onCancel: () => void;
    email?: string;
}

/**
 * MFA Challenge Component
 * 
 * Displayed after successful password authentication to verify TOTP code.
 * Required for HIPAA compliance when accessing PHI.
 */
export function MFAChallenge({ onSuccess, onCancel, email }: MFAChallengeProps) {
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attempts, setAttempts] = useState(0);

    const MAX_ATTEMPTS = 5;

    const handleVerify = useCallback(async () => {
        if (code.length !== 6) {
            setError('Please enter a 6-digit code');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const supabase = createClient();

            // Get MFA factors
            const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

            if (factorsError) throw factorsError;

            const totpFactor = factors?.totp?.[0];

            if (!totpFactor) {
                setError('MFA is not set up. Please contact your administrator.');
                return;
            }

            // Create challenge and verify
            const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
                factorId: totpFactor.id,
            });

            if (challengeError) throw challengeError;

            const { error: verifyError } = await supabase.auth.mfa.verify({
                factorId: totpFactor.id,
                challengeId: challenge.id,
                code,
            });

            if (verifyError) {
                setAttempts(prev => prev + 1);

                if (attempts + 1 >= MAX_ATTEMPTS) {
                    // Too many attempts - sign out
                    await supabase.auth.signOut();
                    toast.error('Too many failed attempts. Please sign in again.');
                    onCancel();
                    return;
                }

                setError(`Invalid code. ${MAX_ATTEMPTS - attempts - 1} attempts remaining.`);
                setCode('');
                return;
            }

            // Success
            toast.success('MFA verified successfully');
            onSuccess();
        } catch (err) {
            console.error('MFA verification error:', err);
            setError('Verification failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [code, attempts, onSuccess, onCancel]);

    // Handle Enter key
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isLoading && code.length === 6) {
            handleVerify();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <div className="w-full max-w-md p-8 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-white text-center mb-2">
                    Two-Factor Authentication
                </h1>
                <p className="text-slate-400 text-center mb-6">
                    Enter the 6-digit code from your authenticator app
                </p>

                {/* User info */}
                {email && (
                    <div className="bg-slate-800/50 rounded-lg px-4 py-3 mb-6 border border-slate-700">
                        <p className="text-slate-400 text-sm text-center">{email}</p>
                    </div>
                )}

                {/* Code Input */}
                <div className="space-y-4">
                    <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="000000"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            onKeyDown={handleKeyDown}
                            className="pl-11 text-center text-2xl tracking-[0.5em] font-mono bg-slate-800 border-slate-700 text-white placeholder:text-slate-600"
                            disabled={isLoading}
                            autoFocus
                            maxLength={6}
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Buttons */}
                    <Button
                        onClick={handleVerify}
                        disabled={isLoading || code.length !== 6}
                        className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-semibold"
                    >
                        {isLoading ? (
                            <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            'Verify Code'
                        )}
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={onCancel}
                        className="w-full text-slate-400 hover:text-white"
                        disabled={isLoading}
                    >
                        Use a different account
                    </Button>
                </div>

                {/* HIPAA Notice */}
                <p className="text-slate-500 text-xs text-center mt-6">
                    Two-factor authentication is required for HIPAA compliance
                    when accessing protected health information.
                </p>
            </div>
        </div>
    );
}
