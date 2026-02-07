'use client';

import { createContext, useContext, useEffect, useRef, useCallback, useState, ReactNode } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';

interface RealtimeState {
    isConnected: boolean;
    lastUpdate: Date | null;
}

interface RealtimeSubscription {
    table: string;
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
}

interface RealtimeContextValue {
    state: RealtimeState;
    subscribe: (subscription: RealtimeSubscription) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

// Throttle updates to prevent render storms
// Returns throttled function and cleanup function
function createThrottle<T extends (...args: Parameters<T>) => void>(
    fn: T,
    delay: number
): { throttled: T; cleanup: () => void } {
    let lastCall = 0;
    let timeoutId: NodeJS.Timeout | null = null;

    const throttled = ((...args: Parameters<T>) => {
        const now = Date.now();
        const remaining = delay - (now - lastCall);

        if (remaining <= 0) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            lastCall = now;
            fn(...args);
        } else if (!timeoutId) {
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                timeoutId = null;
                fn(...args);
            }, remaining);
        }
    }) as T;

    const cleanup = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    return { throttled, cleanup };
}

interface RealtimeProviderProps {
    children: ReactNode;
    throttleMs?: number;
}

export function RealtimeProvider({ children, throttleMs = 500 }: RealtimeProviderProps) {
    const [state, setState] = useState<RealtimeState>({
        isConnected: false,
        lastUpdate: null,
    });

    const channelRef = useRef<RealtimeChannel | null>(null);
    const subscriptionsRef = useRef<Map<string, { subscription: RealtimeSubscription; cleanup: () => void }>>(new Map());
    const idCounterRef = useRef(0);

    // Initialize channel
    useEffect(() => {
        const channel = supabase.channel('crm-realtime', {
            config: {
                broadcast: { self: true },
            },
        });

        channel.on('system', { event: '*' }, (payload: { extension?: string }) => {
            setState((prev) => ({
                ...prev,
                isConnected: payload.extension === 'postgres_changes',
            }));
        });

        channel.subscribe((status: string) => {
            setState((prev) => ({
                ...prev,
                isConnected: status === 'SUBSCRIBED',
            }));
        });

        channelRef.current = channel;

        return () => {
            // Clean up all throttle timeouts before unsubscribing
            subscriptionsRef.current.forEach(entry => entry.cleanup());
            subscriptionsRef.current.clear();
            channel.unsubscribe();
            channelRef.current = null;
        };
    }, []);

    const subscribe = useCallback(
        (subscription: RealtimeSubscription) => {
            const id = `sub-${++idCounterRef.current}`;

            // Wrap callback with throttle - now with proper cleanup
            const { throttled: throttledCallback, cleanup } = createThrottle(
                (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
                    subscription.callback(payload);
                    setState((prev) => ({ ...prev, lastUpdate: new Date() }));
                },
                throttleMs
            );

            const wrappedSubscription = {
                ...subscription,
                callback: throttledCallback,
            };

            subscriptionsRef.current.set(id, { subscription: wrappedSubscription, cleanup });

            // Add postgres_changes listener if channel exists
            if (channelRef.current) {
                (channelRef.current as unknown as { on: (type: string, filter: object, callback: unknown) => void }).on(
                    'postgres_changes',
                    {
                        event: subscription.event,
                        schema: 'public',
                        table: subscription.table,
                    },
                    throttledCallback
                );
            }

            // Return unsubscribe function that cleans up throttle timeout
            return () => {
                const entry = subscriptionsRef.current.get(id);
                if (entry) {
                    entry.cleanup(); // Clear any pending throttle timeout
                }
                subscriptionsRef.current.delete(id);
            };
        },
        [throttleMs]
    );

    return (
        <RealtimeContext.Provider value={{ state, subscribe }}>
            {children}
        </RealtimeContext.Provider>
    );
}

export function useRealtime() {
    const context = useContext(RealtimeContext);
    if (!context) {
        throw new Error('useRealtime must be used within a RealtimeProvider');
    }
    return context;
}

export function useRealtimeSubscription(
    table: string,
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
    deps: React.DependencyList = []
) {
    const { subscribe } = useRealtime();

    useEffect(() => {
        const unsubscribe = subscribe({ table, event, callback });
        return unsubscribe;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [table, event, subscribe, ...deps]);
}
