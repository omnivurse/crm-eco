'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { Card, CardContent, Input, Label, Button } from '@crm-eco/ui';
import { 
  Heart, 
  Users, 
  Shield, 
  Activity, 
  Stethoscope, 
  HandHeart,
  UserCheck,
  HeartPulse,
  Loader2,
  Lock
} from 'lucide-react';
import Link from 'next/link';

// Floating icon component with animation
function FloatingIcon({ 
  icon: Icon, 
  className, 
  delay = 0,
  duration = 6
}: { 
  icon: React.ElementType; 
  className?: string;
  delay?: number;
  duration?: number;
}) {
  return (
    <div 
      className={`absolute opacity-20 text-white ${className}`}
      style={{
        animation: `float ${duration}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }}
    >
      <Icon className="w-full h-full" />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* CSS for floating animation */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          25% {
            transform: translateY(-20px) rotate(5deg);
          }
          50% {
            transform: translateY(-10px) rotate(-3deg);
          }
          75% {
            transform: translateY(-25px) rotate(3deg);
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.15;
          }
          50% {
            opacity: 0.25;
          }
        }
        
        @keyframes gradient-shift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
      `}</style>

      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
        {/* Animated gradient background */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-brand-navy-500 via-brand-teal-700 to-brand-emerald-500"
          style={{
            backgroundSize: '200% 200%',
            animation: 'gradient-shift 15s ease infinite',
          }}
        />
        
        {/* Subtle overlay pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)]" 
          style={{ backgroundSize: '40px 40px' }} 
        />

        {/* Floating health icons */}
        <FloatingIcon icon={Heart} className="w-16 h-16 top-[10%] left-[5%]" delay={0} duration={7} />
        <FloatingIcon icon={Users} className="w-20 h-20 top-[15%] right-[10%]" delay={1} duration={8} />
        <FloatingIcon icon={Shield} className="w-14 h-14 top-[60%] left-[8%]" delay={2} duration={6} />
        <FloatingIcon icon={Activity} className="w-12 h-12 top-[75%] right-[15%]" delay={0.5} duration={7} />
        <FloatingIcon icon={Stethoscope} className="w-18 h-18 top-[25%] left-[15%]" delay={1.5} duration={9} />
        <FloatingIcon icon={HandHeart} className="w-16 h-16 top-[45%] right-[5%]" delay={2.5} duration={6} />
        <FloatingIcon icon={UserCheck} className="w-14 h-14 bottom-[15%] left-[12%]" delay={3} duration={8} />
        <FloatingIcon icon={HeartPulse} className="w-20 h-20 bottom-[20%] right-[8%]" delay={1} duration={7} />
        <FloatingIcon icon={Users} className="w-10 h-10 top-[5%] left-[40%]" delay={2} duration={6} />
        <FloatingIcon icon={Heart} className="w-12 h-12 bottom-[10%] left-[45%]" delay={0} duration={8} />

        {/* Content */}
        <div className="relative z-10 w-full max-w-md">
          {/* Brand header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-4">
              <Heart className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight font-heading">
              Pay It Forward
            </h1>
            <p className="text-brand-teal-100 mt-1 text-lg">HealthShare</p>
            <p className="text-white/60 mt-3 text-sm">Member Portal</p>
          </div>
          
          {/* Glass card */}
          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl">
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-white">Welcome back</h2>
                <p className="text-white/60 text-sm mt-1">
                  Sign in to access your health dashboard
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-red-200 bg-red-500/20 border border-red-400/30 rounded-xl backdrop-blur-sm">
                    {error}
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/80 text-sm">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-brand-teal-400 focus:ring-brand-teal-400/30"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-white/80 text-sm">
                      Password
                    </Label>
                    <button 
                      type="button"
                      className="text-xs text-brand-teal-300 hover:text-brand-teal-200 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-brand-teal-400 focus:ring-brand-teal-400/30"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-white/30 bg-white/10 text-brand-teal-500 focus:ring-brand-teal-400/30"
                  />
                  <label htmlFor="remember" className="text-sm text-white/60">
                    Remember me for 30 days
                  </label>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold bg-brand-teal-600 hover:bg-brand-teal-500 text-white border-0 transition-all duration-200 hover:shadow-lg hover:shadow-brand-teal-500/25"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-white/10 text-center">
                <p className="text-white/60 text-sm">
                  New to Pay It Forward?{' '}
                  <Link 
                    href="/enroll" 
                    className="text-brand-teal-300 hover:text-brand-teal-200 font-medium transition-colors"
                  >
                    Start your enrollment
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
          
          {/* Footer */}
          <div className="mt-6 text-center">
            <div className="flex items-center justify-center gap-2 text-white/40 text-xs">
              <Lock className="w-3 h-3" />
              <span>Secured with enterprise-grade encryption</span>
            </div>
            <p className="text-white/30 text-xs mt-4">
              © 2026 Pay It Forward HealthShare. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
