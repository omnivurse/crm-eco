'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';

function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/dashboard';
    const errorParam = searchParams.get('error');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError) {
            setError(signInError.message);
            setLoading(false);
            return;
        }

        router.push(redirectTo);
        router.refresh();
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
            {/* Logo */}
            <div className="flex items-center justify-center mb-8">
                <div className="w-14 h-14 bg-gradient-to-br from-advisor-500 to-advisor-600 rounded-xl flex items-center justify-center shadow-lg">
                    <ShieldCheck className="w-8 h-8 text-white" />
                </div>
            </div>

            <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
                Advisor Portal
            </h1>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
                Sign in to access your dashboard
            </p>

            {(error || errorParam) && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">
                        {error || (errorParam === 'no_advisor_access' ? 'You do not have advisor access.' : 'An error occurred.')}
                    </p>
                </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Email Address
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-advisor-500 focus:border-transparent transition-all"
                        placeholder="you@company.com"
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Password
                        </label>
                        <Link
                            href="/reset-password"
                            className="text-sm text-advisor-600 hover:text-advisor-700 dark:text-advisor-400 dark:hover:text-advisor-300 transition-colors"
                        >
                            Forgot password?
                        </Link>
                    </div>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-advisor-500 focus:border-transparent transition-all"
                        placeholder="••••••••"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-advisor-500 to-advisor-600 hover:from-advisor-600 hover:to-advisor-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Signing in...
                        </>
                    ) : (
                        'Sign In'
                    )}
                </button>
            </form>
        </div>
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-advisor-50 via-white to-advisor-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
            <div className="w-full max-w-md p-8">
                <Suspense fallback={
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-advisor-500" />
                    </div>
                }>
                    <LoginForm />
                </Suspense>

                <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Need help? Contact your administrator
                </p>
            </div>
        </div>
    );
}

