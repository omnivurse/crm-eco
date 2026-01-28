/**
 * Session Security Utilities
 * 
 * HIPAA-compliant session management with:
 * - 30-minute inactivity timeout
 * - Session tracking and validation
 * - Force logout capability
 */

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { cookies } from 'next/headers';

// Generate UUID without external dependency
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Session timeout: 30 minutes of inactivity
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const SESSION_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours max

export interface SessionInfo {
    id: string;
    userId: string;
    sessionToken: string;
    ipAddress: string | null;
    userAgent: string | null;
    lastActivityAt: Date;
    expiresAt: Date;
    isActive: boolean;
    mfaVerified: boolean;
    createdAt: Date;
}

/**
 * Get the session token from cookies
 */
export async function getSessionToken(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get('session_token')?.value || null;
}

/**
 * Set session token in cookies
 */
export async function setSessionToken(token: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set('session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_ABSOLUTE_TIMEOUT_MS / 1000,
        path: '/',
    });
}

/**
 * Clear session token from cookies
 */
export async function clearSessionToken(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete('session_token');
}

/**
 * Create a new session for a user
 */
export async function createSession(
    userId: string,
    ipAddress: string | null,
    userAgent: string | null
): Promise<string> {
    const supabase = await createServerSupabaseClient();
    const sessionToken = generateUUID();
    const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_TIMEOUT_MS);

    await (supabase.from('user_sessions') as any).insert({
        user_id: userId,
        session_token: sessionToken,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        mfa_verified: false,
    });

    await setSessionToken(sessionToken);
    return sessionToken;
}

/**
 * Validate and refresh a session
 * Returns null if session is invalid or expired
 */
export async function validateSession(): Promise<SessionInfo | null> {
    const sessionToken = await getSessionToken();
    if (!sessionToken) return null;

    const supabase = await createServerSupabaseClient();

    const { data: session, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .eq('is_active', true)
        .single();

    if (error || !session) {
        await clearSessionToken();
        return null;
    }

    const sessionData = session as any;

    // Check absolute timeout
    if (new Date(sessionData.expires_at) < new Date()) {
        await invalidateSession(sessionToken);
        return null;
    }

    // Check inactivity timeout (30 minutes)
    const lastActivity = new Date(sessionData.last_activity_at);
    const inactivityThreshold = new Date(Date.now() - SESSION_TIMEOUT_MS);

    if (lastActivity < inactivityThreshold) {
        await invalidateSession(sessionToken);
        return null;
    }

    // Update last activity
    await (supabase.from('user_sessions') as any)
        .update({ last_activity_at: new Date().toISOString() })
        .eq('session_token', sessionToken);

    return {
        id: sessionData.id,
        userId: sessionData.user_id,
        sessionToken: sessionData.session_token,
        ipAddress: sessionData.ip_address,
        userAgent: sessionData.user_agent,
        lastActivityAt: new Date(sessionData.last_activity_at),
        expiresAt: new Date(sessionData.expires_at),
        isActive: sessionData.is_active,
        mfaVerified: sessionData.mfa_verified,
        createdAt: new Date(sessionData.created_at),
    };
}

/**
 * Mark MFA as verified for current session
 */
export async function markSessionMFAVerified(): Promise<void> {
    const sessionToken = await getSessionToken();
    if (!sessionToken) return;

    const supabase = await createServerSupabaseClient();
    await supabase
        .from('user_sessions')
        .update({ mfa_verified: true } as never)
        .eq('session_token', sessionToken);
}

/**
 * Invalidate a specific session
 */
export async function invalidateSession(sessionToken: string): Promise<void> {
    const supabase = await createServerSupabaseClient();
    await supabase
        .from('user_sessions')
        .update({ is_active: false } as never)
        .eq('session_token', sessionToken);

    const currentToken = await getSessionToken();
    if (currentToken === sessionToken) {
        await clearSessionToken();
    }
}

/**
 * Invalidate all sessions for a user (logout everywhere)
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
    const supabase = await createServerSupabaseClient();
    await supabase
        .from('user_sessions')
        .update({ is_active: false } as never)
        .eq('user_id', userId)
        .eq('is_active', true);

    await clearSessionToken();
}

/**
 * Get all active sessions for a user
 */
export async function getUserActiveSessions(userId: string): Promise<SessionInfo[]> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity_at', { ascending: false });

    if (error || !data) return [];

    return (data as any[]).map((session: any) => ({
        id: session.id,
        userId: session.user_id,
        sessionToken: session.session_token,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        lastActivityAt: new Date(session.last_activity_at),
        expiresAt: new Date(session.expires_at),
        isActive: session.is_active,
        mfaVerified: session.mfa_verified,
        createdAt: new Date(session.created_at),
    }));
}

/**
 * Check if current session needs MFA verification
 */
export async function sessionNeedsMFA(): Promise<boolean> {
    const session = await validateSession();
    if (!session) return true; // No valid session, redirect to login
    return !session.mfaVerified;
}

/**
 * Get time remaining before session expires due to inactivity
 */
export async function getSessionTimeRemaining(): Promise<number | null> {
    const session = await validateSession();
    if (!session) return null;

    const expiresAt = new Date(session.lastActivityAt.getTime() + SESSION_TIMEOUT_MS);
    const remaining = expiresAt.getTime() - Date.now();
    return Math.max(0, remaining);
}
