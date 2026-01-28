'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Button, Input, Label } from '@crm-eco/ui';
import {
  Shield,
  Activity,
  Users,
  Settings,
  Database,
  BarChart3,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Square,
  Sparkles,
  Zap,
  Building2,
  UserCog,
} from 'lucide-react';
import Image from 'next/image';

// Admin Portal Orbit Animation - with admin/system icons
function AdminOrbitAnimation() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Ambient glow layers - purple/blue for admin */}
      <div className="absolute w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute w-[300px] h-[300px] bg-blue-500/15 rounded-full blur-[80px] animate-[pulse_4s_ease-in-out_infinite]" />
      <div className="absolute w-[200px] h-[200px] bg-purple-400/20 rounded-full blur-[60px] animate-[pulse_3s_ease-in-out_infinite_0.5s]" />

      {/* Core nucleus - Company Logo */}
      <div className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-purple-400/30 to-blue-500/20 backdrop-blur-xl border border-purple-400/40 flex items-center justify-center z-20 shadow-[0_0_60px_20px_rgba(147,51,234,0.3)]">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400/20 to-transparent animate-[spin_8s_linear_infinite]" />
        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-[0_0_30px_10px_rgba(147,51,234,0.4)] overflow-hidden">
          <Image
            src="/logo-icon.png"
            alt="Pay It Forward"
            width={48}
            height={48}
            className="w-12 h-12 object-contain animate-[pulse_2s_ease-in-out_infinite]"
          />
        </div>
      </div>

      {/* Pulsing core ring */}
      <div className="absolute w-32 h-32 rounded-full border border-purple-400/30 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
      <div className="absolute w-36 h-36 rounded-full border border-purple-400/20 animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]" />

      {/* Orbit Ring 1 - Fast inner - Admin icons */}
      <div className="absolute w-[220px] h-[220px]">
        <div className="absolute inset-0 rounded-full border border-white/10" />
        <div className="absolute inset-0 rounded-full border border-purple-400/20 animate-[spin_15s_linear_infinite]">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-slate-900 p-2.5 rounded-full border border-purple-400/50 shadow-[0_0_20px_5px_rgba(147,51,234,0.3)]">
                <Shield className="w-4 h-4 text-purple-400" />
              </div>
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-slate-900 p-2.5 rounded-full border border-blue-400/50 shadow-[0_0_20px_5px_rgba(96,165,250,0.3)]">
                <Settings className="w-4 h-4 text-blue-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Orbit Ring 2 - Medium */}
      <div className="absolute w-[360px] h-[360px]">
        <div className="absolute inset-0 rounded-full border border-white/5" />
        <div className="absolute inset-0 rounded-full border border-dashed border-purple-500/10 animate-[spin_25s_linear_infinite_reverse]">
          <div className="absolute top-8 -left-2">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-slate-900 p-3 rounded-full border border-indigo-400/50 shadow-[0_0_20px_5px_rgba(129,140,248,0.3)]">
                <Users className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
          </div>
          <div className="absolute bottom-8 -right-2">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-slate-900 p-3 rounded-full border border-emerald-400/50 shadow-[0_0_20px_5px_rgba(52,211,153,0.3)]">
                <Database className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </div>
          <div className="absolute top-1/2 -left-3 -translate-y-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-slate-900 p-2.5 rounded-full border border-violet-400/50 shadow-[0_0_20px_5px_rgba(167,139,250,0.3)]">
                <Sparkles className="w-4 h-4 text-violet-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Orbit Ring 3 - Outer slow */}
      <div className="absolute w-[500px] h-[500px]">
        <div className="absolute inset-0 rounded-full border border-white/5" />
        <div className="absolute inset-0 rounded-full animate-[spin_40s_linear_infinite]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-slate-900 p-3 rounded-full border border-amber-400/50 shadow-[0_0_20px_5px_rgba(251,191,36,0.3)]">
                <Building2 className="w-5 h-5 text-amber-400" />
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-pink-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-slate-900 p-3 rounded-full border border-pink-400/50 shadow-[0_0_20px_5px_rgba(244,114,182,0.3)]">
                <BarChart3 className="w-5 h-5 text-pink-400" />
              </div>
            </div>
          </div>
          <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-slate-900 p-2.5 rounded-full border border-cyan-400/50 shadow-[0_0_20px_5px_rgba(34,211,238,0.3)]">
                <UserCog className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
          </div>
          <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-lime-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-slate-900 p-2.5 rounded-full border border-lime-400/50 shadow-[0_0_20px_5px_rgba(163,230,53,0.3)]">
                <Zap className="w-4 h-4 text-lime-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating particles */}
      {[...Array(40)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 4 + 2 + 'px',
            height: Math.random() * 4 + 2 + 'px',
            background: `rgba(${Math.random() > 0.5 ? '147, 51, 234' : '96, 165, 250'}, ${Math.random() * 0.5 + 0.3})`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animation: `float-particle ${Math.random() * 10 + 15}s linear infinite`,
            animationDelay: `${Math.random() * -20}s`,
            boxShadow: `0 0 ${Math.random() * 10 + 5}px rgba(147, 51, 234, 0.5)`,
          }}
        />
      ))}

      {/* Shooting stars */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div
            key={`stream-${i}`}
            className="absolute h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-60"
            style={{
              width: Math.random() * 100 + 50 + 'px',
              top: `${Math.random() * 100}%`,
              left: '-100px',
              animation: `shooting-star ${Math.random() * 3 + 2}s linear infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      console.log('Starting login process...');
      console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      console.log('Attempting sign in with email:', email);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Sign in response:', { data: data ? 'received' : 'null', error: signInError });

      if (signInError) {
        console.error('Sign in error:', signInError);
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        console.log('User authenticated, fetching profile...');
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', data.user.id)
          .single();

        console.log('Profile response:', { profile: profile ? 'found' : 'null', error: profileError });

        if (profileError || !profile) {
          console.error('Profile error:', profileError);
          setError('No profile found. Please contact your administrator.');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        // Check if user has admin access
        console.log('User role:', profile.role);
        if (!['owner', 'super_admin', 'admin', 'staff'].includes(profile.role)) {
          setError('You do not have admin access. Please contact your administrator.');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        console.log('Login successful, redirecting to dashboard...');
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      console.error('Unexpected login error:', err);
      setError('An unexpected error occurred. Please check the console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style jsx global>{`
        @keyframes float-particle {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          50% {
            transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px) scale(1.5);
          }
          90% {
            opacity: 1;
          }
        }

        @keyframes shooting-star {
          0% {
            transform: translateX(0) translateY(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateX(calc(100vw + 200px)) translateY(100px);
            opacity: 0;
          }
        }

        @keyframes gradient-flow {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
      `}</style>

      <div className="min-h-screen grid lg:grid-cols-2">
        {/* Left Side - Premium Visuals */}
        <div className="hidden lg:flex relative overflow-hidden items-center justify-center bg-slate-950">
          {/* Animated gradient background - purple/blue for admin */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-purple-950"
            style={{
              backgroundSize: '400% 400%',
              animation: 'gradient-flow 15s ease infinite',
            }}
          />

          {/* Mesh gradient overlay */}
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,rgba(147,51,234,0.3),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(96,165,250,0.2),transparent_50%)]" />

          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:50px_50px]" />

          <AdminOrbitAnimation />

          {/* Bottom branding */}
          <div className="absolute bottom-12 left-12 z-10">
            <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Admin Portal</span>
              <br />
              <span className="text-white/90">Pay It Forward</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-md">
              System administration and management console
            </p>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center lg:text-left">
              <div className="flex justify-center lg:justify-start mb-6">
                <Image
                  src="/logo.png"
                  alt="Pay It Forward HealthShare"
                  width={200}
                  height={80}
                  className="h-16 w-auto object-contain"
                  priority
                />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-800">
                Admin Portal
              </h2>
              <p className="mt-2 text-slate-500">
                Sign in to manage members, agents, and enrollments
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 text-sm font-medium">
                    Email Address
                  </Label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-purple-600 transition-colors z-10" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="relative pl-12 h-14 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-500/20 rounded-xl transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-700 text-sm font-medium">
                      Password
                    </Label>
                    <button
                      type="button"
                      className="text-sm text-purple-600 hover:text-purple-700 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-purple-600 transition-colors z-10" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="•••••••••••••"
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="relative pl-12 pr-12 h-14 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-500/20 rounded-xl transition-all shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${rememberMe
                      ? 'bg-purple-500 border-purple-500 shadow-[0_0_10px_2px_rgba(147,51,234,0.3)]'
                      : 'border-slate-300 bg-white hover:border-slate-400'
                    }`}
                >
                  {rememberMe && <Square className="w-2.5 h-2.5 text-white fill-current" />}
                </button>
                <label
                  onClick={() => setRememberMe(!rememberMe)}
                  className="text-sm text-slate-600 cursor-pointer select-none"
                >
                  Remember me for 30 days
                </label>
              </div>

              <Button
                type="submit"
                className="relative w-full h-14 text-base font-semibold bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-white border-0 rounded-xl transition-all overflow-hidden group"
                disabled={loading}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-purple-600 text-xs font-medium">
                <Shield className="w-3.5 h-3.5" />
                <span>Secured with enterprise-grade encryption</span>
              </div>
              <p className="text-slate-400 text-xs">
                © 2026 Pay It Forward HealthShare. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
