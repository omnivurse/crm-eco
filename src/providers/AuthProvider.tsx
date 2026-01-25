import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'member' | 'advisor' | 'staff' | 'agent' | 'admin' | 'super_admin' | 'concierge';
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      console.log('✅ Profile fetched successfully:', {
        userId: userId,
        email: data?.email,
        role: data?.role,
        full_name: data?.full_name,
        timestamp: new Date().toISOString()
      });

      if (data?.role === 'super_admin') {
        console.log('🔑 SUPER ADMIN ACCESS GRANTED:', {
          email: data.email,
          full_name: data.full_name,
          message: 'User has unrestricted access to all features'
        });
      }

      setProfile(data);
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const verifyAndRefreshSession = async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Session verification error:', error);
        return false;
      }

      if (currentSession) {
        const expiresAt = currentSession.expires_at;
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt ? expiresAt - now : 0;

        if (timeUntilExpiry < 300) {
          console.log('🔄 Token expiring soon, refreshing session...');
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError) {
            console.error('Session refresh error:', refreshError);
            return false;
          }

          if (refreshedSession) {
            console.log('✅ Session refreshed successfully');
            setSession(refreshedSession);
            setUser(refreshedSession.user);
            return true;
          }
        }

        setSession(currentSession);
        setUser(currentSession.user);
        return true;
      } else {
        console.log('⚠️ No active session found');
        setSession(null);
        setUser(null);
        setProfile(null);
        return false;
      }
    } catch (error) {
      console.error('Session verification failed:', error);
      return false;
    }
  };

  const trackActivity = () => {
    lastActivityRef.current = Date.now();
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('🔐 Initializing authentication...');
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Failed to get initial session:', error);
          setLoading(false);
          return;
        }

        if (initialSession) {
          console.log('✅ Session recovered from storage:', {
            userId: initialSession.user.id,
            expiresAt: new Date((initialSession.expires_at || 0) * 1000).toISOString()
          });

          setSession(initialSession);
          setUser(initialSession.user);
          await fetchProfile(initialSession.user.id);
        } else {
          console.log('ℹ️ No existing session found');
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, currentSession) => {
      (async () => {
        console.log('🔔 Auth state changed:', event);

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          if (sessionCheckInterval.current) {
            clearInterval(sessionCheckInterval.current);
            sessionCheckInterval.current = null;
          }
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (currentSession) {
            setSession(currentSession);
            setUser(currentSession.user);
            await fetchProfile(currentSession.user.id);
          }
        } else if (event === 'USER_UPDATED') {
          if (currentSession) {
            setSession(currentSession);
            setUser(currentSession.user);
            await fetchProfile(currentSession.user.id);
          }
        } else if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          if (!profile || profile.id !== currentSession.user.id) {
            await fetchProfile(currentSession.user.id);
          }
        }
      })();
    });

    document.addEventListener('click', trackActivity);
    document.addEventListener('keypress', trackActivity);
    document.addEventListener('scroll', trackActivity);
    document.addEventListener('mousemove', trackActivity);

    sessionCheckInterval.current = setInterval(async () => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity < 300000) {
        await verifyAndRefreshSession();
      }
    }, 60000);

    window.addEventListener('storage', (e) => {
      if (e.key === 'mpb-health-auth-token' && e.newValue === null) {
        console.log('🚪 Session cleared in another tab, logging out...');
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
      }
      document.removeEventListener('click', trackActivity);
      document.removeEventListener('keypress', trackActivity);
      document.removeEventListener('scroll', trackActivity);
      document.removeEventListener('mousemove', trackActivity);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setSession(null);
    if (sessionCheckInterval.current) {
      clearInterval(sessionCheckInterval.current);
      sessionCheckInterval.current = null;
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
