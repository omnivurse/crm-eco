'use client';

import { useState } from 'react';
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
  Atom,
  Eye,
  EyeOff,
  Mail,
  Square,
  BarChart3,
  Database,
  Briefcase,
  Target
} from 'lucide-react';

// Orbit animation component for CRM
function OrbitAnimation() {
  return (
    <div className="relative w-[600px] h-[600px] flex items-center justify-center">
      {/* Core */}
      <div className="absolute w-32 h-32 bg-brand-teal-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute w-16 h-16 bg-brand-teal-400/10 rounded-full border border-brand-teal-400/30 flex items-center justify-center backdrop-blur-sm z-10">
        <Atom className="w-8 h-8 text-brand-teal-300 animate-[spin_10s_linear_infinite]" />
      </div>

      {/* Orbit Rings */}
      {/* Ring 1 - CRM Icons */}
      <div className="absolute w-[280px] h-[280px] border border-white/5 rounded-full animate-[spin_20s_linear_infinite]" />
      <div className="absolute w-[280px] h-[280px] animate-[spin_20s_linear_infinite]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-navy-900 p-2 rounded-full border border-white/10">
          <Users className="w-4 h-4 text-brand-teal-400" />
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-brand-navy-900 p-2 rounded-full border border-white/10">
          <BarChart3 className="w-4 h-4 text-violet-400" />
        </div>
      </div>

      {/* Ring 2 */}
      <div className="absolute w-[420px] h-[420px] border border-white/5 rounded-full animate-[spin_30s_linear_infinite_reverse]" />
      <div className="absolute w-[420px] h-[420px] animate-[spin_30s_linear_infinite_reverse]">
        <div className="absolute top-1/4 left-[10%] bg-brand-navy-900 p-2 rounded-full border border-white/10">
          <Briefcase className="w-5 h-5 text-blue-400" />
        </div>
        <div className="absolute bottom-1/4 right-[10%] bg-brand-navy-900 p-2 rounded-full border border-white/10">
          <Database className="w-5 h-5 text-emerald-400" />
        </div>
      </div>

      {/* Ring 3 */}
      <div className="absolute w-[560px] h-[560px] border border-white/5 rounded-full animate-[spin_40s_linear_infinite]" />
      <div className="absolute w-[560px] h-[560px] animate-[spin_40s_linear_infinite]">
        <div className="absolute top-1/2 -right-3 bg-brand-navy-900 p-2 rounded-full border border-white/10">
          <Target className="w-4 h-4 text-amber-400" />
        </div>
        <div className="absolute top-1/2 -left-3 bg-brand-navy-900 p-2 rounded-full border border-white/10">
          <HeartHandshake className="w-4 h-4 text-rose-400" />
        </div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute bg-white/20 rounded-full"
            style={{
              width: Math.random() * 3 + 1 + 'px',
              height: Math.random() * 3 + 1 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              animation: `pulse ${Math.random() * 3 + 2}s infinite`,
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
      // Sign in with Supabase
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

      // Check if user has CRM access (crm_role in profiles)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, crm_role, organization_id')
        .eq('user_id', authData.user.id)
        .not('crm_role', 'is', null)
        .single();

      if (profileError || !profile) {
        // User doesn't have CRM access
        await supabase.auth.signOut();
        setError('You do not have access to the CRM. Please contact your administrator.');
        setLoading(false);
        return;
      }

      // Redirect to CRM dashboard
      router.push('/crm');
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-brand-navy-950">
      {/* Left Side - Orbit Visuals */}
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-teal-900 items-center justify-center">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
        
        <OrbitAnimation />

        {/* Bottom Text */}
        <div className="absolute bottom-12 left-12 z-10">
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            <span className="text-brand-teal-400">MPB</span> Orbit
          </h1>
          <p className="text-brand-navy-200 text-lg max-w-md">
            Your mission control center for healthcare excellence
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex items-center justify-center p-8 bg-brand-navy-950 text-white">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <div className="flex justify-center lg:justify-start mb-6">
              <div className="w-14 h-14 bg-brand-teal-500/20 rounded-xl flex items-center justify-center border border-brand-teal-500/30">
                <Users className="w-7 h-7 text-brand-teal-400" />
              </div>
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              Welcome back, Commander
            </h2>
            <p className="mt-2 text-brand-navy-200">
              Enter your credentials to access mission control
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-200 bg-red-500/10 border border-red-500/20 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-brand-navy-100">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-brand-navy-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="vrt@mympb.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="pl-10 h-12 bg-brand-navy-900/50 border-brand-navy-700 text-white placeholder:text-brand-navy-500 focus:border-brand-teal-500 focus:ring-brand-teal-500/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-brand-navy-100">
                    Password
                  </Label>
                  <button 
                    type="button"
                    className="text-sm text-brand-teal-400 hover:text-brand-teal-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-brand-navy-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="•••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pl-10 pr-10 h-12 bg-brand-navy-900/50 border-brand-navy-700 text-white placeholder:text-brand-navy-500 focus:border-brand-teal-500 focus:ring-brand-teal-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-brand-navy-400 hover:text-brand-navy-300"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  rememberMe 
                    ? 'bg-brand-teal-600 border-brand-teal-600' 
                    : 'border-brand-navy-600 bg-brand-navy-900/50 hover:border-brand-navy-500'
                }`}
              >
                {rememberMe && <Square className="w-3 h-3 text-white fill-current" />}
              </button>
              <label 
                onClick={() => setRememberMe(!rememberMe)}
                className="text-sm text-brand-navy-200 cursor-pointer select-none"
              >
                Remember me for 30 days
              </label>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold bg-brand-teal-500 hover:bg-brand-teal-400 text-white border-0 transition-all shadow-[0_0_20px_-5px_rgba(6,155,154,0.5)] hover:shadow-[0_0_25px_-5px_rgba(6,155,154,0.6)]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in to Mission Control
                  <span className="ml-2">→</span>
                </>
              )}
            </Button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-brand-navy-800"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-brand-navy-950 px-2 text-brand-navy-400 text-xs uppercase tracking-wider">
                  Need Access?
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 border-brand-navy-700 bg-brand-navy-900/30 text-brand-navy-100 hover:bg-brand-navy-800 hover:text-white"
              onClick={() => window.location.href = 'mailto:support@payitforwardhealthshare.com'}
            >
              Contact Administrator
            </Button>
          </form>

          <div className="mt-8 text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-brand-teal-500/80 text-xs font-medium">
              <Shield className="w-3 h-3" />
              <span>Secured with enterprise-grade encryption</span>
            </div>
            <p className="text-brand-navy-600 text-xs">
              © 2026 MPB Health. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
