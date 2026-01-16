'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { 
  Heart, 
  Users, 
  Shield, 
  Activity, 
  Stethoscope, 
  HeartHandshake,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Square,
  BarChart3,
  Database,
  Briefcase,
  Target,
  Zap,
  Globe,
  TrendingUp
} from 'lucide-react';
import Image from 'next/image';

// Premium Orbit Animation with enhanced effects
function PremiumOrbitAnimation() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Ambient glow layers */}
      <div className="absolute w-[500px] h-[500px] bg-brand-teal-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute w-[300px] h-[300px] bg-brand-emerald-500/15 rounded-full blur-[80px] animate-[pulse_4s_ease-in-out_infinite]" />
      <div className="absolute w-[200px] h-[200px] bg-brand-teal-400/20 rounded-full blur-[60px] animate-[pulse_3s_ease-in-out_infinite_0.5s]" />
      
      {/* Core nucleus with pulsing rings */}
      <div className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-brand-teal-400/30 to-brand-emerald-500/20 backdrop-blur-xl border border-brand-teal-400/40 flex items-center justify-center z-20 shadow-[0_0_60px_20px_rgba(6,155,154,0.3)]">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-teal-400/20 to-transparent animate-[spin_8s_linear_infinite]" />
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-teal-400 to-brand-emerald-500 flex items-center justify-center shadow-[0_0_30px_10px_rgba(6,155,154,0.4)]">
          <Heart className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Pulsing core ring */}
      <div className="absolute w-32 h-32 rounded-full border border-brand-teal-400/30 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />

      {/* Orbit Ring 1 - Fast inner */}
      <div className="absolute w-[220px] h-[220px]">
        <div className="absolute inset-0 rounded-full border border-white/10" />
        <div className="absolute inset-0 rounded-full border border-brand-teal-400/20 animate-[spin_15s_linear_infinite]">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-teal-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-brand-navy-800 p-2.5 rounded-full border border-brand-teal-400/50 shadow-[0_0_20px_5px_rgba(6,155,154,0.3)]">
                <Users className="w-4 h-4 text-brand-teal-400" />
              </div>
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-brand-navy-800 p-2.5 rounded-full border border-violet-400/50 shadow-[0_0_20px_5px_rgba(139,92,246,0.3)]">
                <BarChart3 className="w-4 h-4 text-violet-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Orbit Ring 2 - Medium */}
      <div className="absolute w-[360px] h-[360px]">
        <div className="absolute inset-0 rounded-full border border-white/5" />
        <div className="absolute inset-0 rounded-full border border-dashed border-brand-teal-500/10 animate-[spin_25s_linear_infinite_reverse]">
          <div className="absolute top-8 -left-2">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-brand-navy-800 p-3 rounded-full border border-blue-400/50 shadow-[0_0_20px_5px_rgba(96,165,250,0.3)]">
                <Briefcase className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </div>
          <div className="absolute bottom-8 -right-2">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-brand-navy-800 p-3 rounded-full border border-emerald-400/50 shadow-[0_0_20px_5px_rgba(52,211,153,0.3)]">
                <Database className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </div>
          <div className="absolute top-1/2 -left-3 -translate-y-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-brand-navy-800 p-2.5 rounded-full border border-cyan-400/50 shadow-[0_0_20px_5px_rgba(34,211,238,0.3)]">
                <Zap className="w-4 h-4 text-cyan-400" />
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
              <div className="relative bg-brand-navy-800 p-3 rounded-full border border-amber-400/50 shadow-[0_0_20px_5px_rgba(251,191,36,0.3)]">
                <Target className="w-5 h-5 text-amber-400" />
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-rose-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-brand-navy-800 p-3 rounded-full border border-rose-400/50 shadow-[0_0_20px_5px_rgba(251,113,133,0.3)]">
                <HeartHandshake className="w-5 h-5 text-rose-400" />
              </div>
            </div>
          </div>
          <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-brand-navy-800 p-2.5 rounded-full border border-indigo-400/50 shadow-[0_0_20px_5px_rgba(129,140,248,0.3)]">
                <Globe className="w-4 h-4 text-indigo-400" />
              </div>
            </div>
          </div>
          <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-green-400 rounded-full blur-md animate-pulse" />
              <div className="relative bg-brand-navy-800 p-2.5 rounded-full border border-green-400/50 shadow-[0_0_20px_5px_rgba(74,222,128,0.3)]">
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating data particles */}
      {[...Array(40)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 4 + 2 + 'px',
            height: Math.random() * 4 + 2 + 'px',
            background: `rgba(${Math.random() > 0.5 ? '6, 155, 154' : '2, 115, 67'}, ${Math.random() * 0.5 + 0.3})`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animation: `float-particle ${Math.random() * 10 + 15}s linear infinite`,
            animationDelay: `${Math.random() * -20}s`,
            boxShadow: `0 0 ${Math.random() * 10 + 5}px rgba(6, 155, 154, 0.5)`,
          }}
        />
      ))}

      {/* Shooting stars / data streams */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div
            key={`stream-${i}`}
            className="absolute h-px bg-gradient-to-r from-transparent via-brand-teal-400 to-transparent opacity-60"
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

export default function CrmLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Authentication failed');
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, crm_role, organization_id')
        .eq('user_id', authData.user.id)
        .not('crm_role', 'is', null)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setError('You do not have access to the CRM. Please contact your administrator.');
        setLoading(false);
        return;
      }

      router.push('/crm');
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred');
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
        <div className="hidden lg:flex relative overflow-hidden items-center justify-center bg-brand-navy-950">
          {/* Animated gradient background */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-brand-navy-900 via-brand-navy-950 to-brand-teal-950"
            style={{
              backgroundSize: '400% 400%',
              animation: 'gradient-flow 15s ease infinite',
            }}
          />
          
          {/* Mesh gradient overlay */}
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,rgba(6,155,154,0.3),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(2,115,67,0.2),transparent_50%)]" />
          
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:50px_50px]" />
          
          <PremiumOrbitAnimation />

          {/* Bottom branding */}
          <div className="absolute bottom-12 left-12 z-10">
            <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
              <span className="bg-gradient-to-r from-brand-teal-400 to-brand-emerald-400 bg-clip-text text-transparent">Pay It Forward</span>
              <br />
              <span className="text-white/90">HealthShare</span>
            </h1>
            <p className="text-brand-navy-300 text-lg max-w-md">
              CRM Portal — Manage your healthcare community
            </p>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center lg:text-left">
              <div className="flex justify-center lg:justify-start mb-6">
                <Image
                  src="/logo-pif.jpg"
                  alt="Pay It Forward HealthShare"
                  width={200}
                  height={80}
                  className="h-16 w-auto object-contain"
                  priority
                />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-brand-navy-800">
                Welcome back
              </h2>
              <p className="mt-2 text-brand-navy-500">
                Sign in to access your CRM dashboard
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-brand-navy-700 text-sm font-medium">
                    Email Address
                  </Label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-teal-500/20 to-brand-emerald-500/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-brand-navy-400 group-focus-within:text-brand-teal-600 transition-colors z-10" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="relative pl-12 h-14 bg-white border-brand-navy-200 text-brand-navy-900 placeholder:text-brand-navy-400 focus:border-brand-teal-500 focus:ring-brand-teal-500/20 rounded-xl transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-brand-navy-700 text-sm font-medium">
                      Password
                    </Label>
                    <button 
                      type="button"
                      className="text-sm text-brand-teal-600 hover:text-brand-teal-700 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-teal-500/20 to-brand-emerald-500/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-brand-navy-400 group-focus-within:text-brand-teal-600 transition-colors z-10" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="•••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="relative pl-12 pr-12 h-14 bg-white border-brand-navy-200 text-brand-navy-900 placeholder:text-brand-navy-400 focus:border-brand-teal-500 focus:ring-brand-teal-500/20 rounded-xl transition-all shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-navy-400 hover:text-brand-navy-600 z-10"
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
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    rememberMe 
                      ? 'bg-brand-teal-500 border-brand-teal-500 shadow-[0_0_10px_2px_rgba(6,155,154,0.3)]' 
                      : 'border-brand-navy-300 bg-white hover:border-brand-navy-400'
                  }`}
                >
                  {rememberMe && <Square className="w-2.5 h-2.5 text-white fill-current" />}
                </button>
                <label 
                  onClick={() => setRememberMe(!rememberMe)}
                  className="text-sm text-brand-navy-600 cursor-pointer select-none"
                >
                  Remember me for 30 days
                </label>
              </div>

              <Button 
                type="submit" 
                className="relative w-full h-14 text-base font-semibold bg-gradient-to-r from-brand-teal-500 to-brand-emerald-500 hover:from-brand-teal-400 hover:to-brand-emerald-400 text-white border-0 rounded-xl transition-all overflow-hidden group"
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
                    Sign in to CRM
                    <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                  </>
                )}
              </Button>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-brand-navy-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-brand-navy-400 text-xs uppercase tracking-widest">
                    Need CRM Access?
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-14 border-brand-navy-200 bg-white text-brand-navy-700 hover:bg-brand-navy-50 hover:text-brand-navy-900 hover:border-brand-navy-300 rounded-xl transition-all shadow-sm"
                onClick={() => window.location.href = 'mailto:support@payitforwardhealthshare.com'}
              >
                Contact Administrator
              </Button>
            </form>

            <div className="mt-8 text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-brand-teal-600 text-xs font-medium">
                <Shield className="w-3.5 h-3.5" />
                <span>Secured with enterprise-grade encryption</span>
              </div>
              <p className="text-brand-navy-400 text-xs">
                © 2026 Pay It Forward HealthShare. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
