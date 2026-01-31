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
function throttle<T extends (...args: Parameters<T>) => void>(
    fn: T,
    delay: number
): T {
    let lastCall = 0;
    let timeoutId: NodeJS.Timeout | null = null;

    return ((...args: Parameters<T>) => {
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
    const subscriptionsRef = useRef<Map<string, RealtimeSubscription>>(new Map());
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
            channel.unsubscribe();
            channelRef.current = null;
        };
    }, []);

    const subscribe = useCallback(
        (subscription: RealtimeSubscription) => {
            const id = `sub-${++idCounterRef.current}`;

            // Wrap callback with throttle
            const throttledCallback = throttle(
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

            subscriptionsRef.current.set(id, wrappedSubscription);

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

            // Return unsubscribe function
            return () => {
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
