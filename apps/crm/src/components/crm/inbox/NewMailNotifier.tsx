'use client';

/**
 * Announces inbound email anywhere in the CRM.
 *
 * Mounted in the shell rather than on the inbox page because the point is to
 * reach an agent who is NOT looking at the inbox — someone on a record or a
 * report is exactly who needs telling. The inbox page keeps its own
 * subscription for list refresh; this one only raises alerts.
 *
 * Renders nothing.
 */

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';
import {
  buildNewMailToast,
  decideNotify,
  type IncomingMessage,
} from '@/lib/inbox/new-mail-notification';
import {
  decideDesktopAlert,
  readNotificationPrefs,
} from '@/lib/inbox/notification-prefs';

interface NewMailNotifierProps {
  organizationId: string;
}

/**
 * Short chime synthesised with Web Audio.
 *
 * Deliberately not an audio file: shipping a binary asset for two notes means
 * another request, another thing to cache-bust, and a 404 that fails silently.
 * Fails quietly if the browser blocks audio before a user gesture.
 */
function playChime() {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    // Quiet by design — an alert, not an announcement.
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);

    [880, 1174.7].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.11);
      osc.stop(ctx.currentTime + i * 0.11 + 0.3);
    });

    // Release the hardware once the sound has finished.
    window.setTimeout(() => void ctx.close().catch(() => undefined), 800);
  } catch {
    // Autoplay policy or no audio device — never worth breaking the toast over.
  }
}

export function NewMailNotifier({ organizationId }: NewMailNotifierProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Kept in refs so a route change never tears down the subscription: the
  // channel should live as long as the session, not as long as a page.
  const pathnameRef = useRef(pathname);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const announce = useCallback(
    (message: IncomingMessage) => {
      const documentVisible =
        typeof document === 'undefined' ? true : document.visibilityState === 'visible';

      const decision = decideNotify({
        message,
        pathname: pathnameRef.current || '',
        seenMessageIds: seenIdsRef.current,
        documentVisible,
      });
      if (!decision.notify) return;

      seenIdsRef.current.add(message.id);
      // Bound the dedupe set so a long session cannot grow it without limit.
      if (seenIdsRef.current.size > 500) {
        seenIdsRef.current = new Set(Array.from(seenIdsRef.current).slice(-200));
      }

      const content = buildNewMailToast(message);

      toast(content.title, {
        description: content.description,
        icon: <Mail className="h-4 w-4 text-blue-500" />,
        duration: 10000,
        action: {
          label: 'Open',
          onClick: () => router.push(content.href),
        },
      });

      const prefs = readNotificationPrefs(
        typeof window === 'undefined' ? null : window.localStorage,
      );

      if (prefs.sound) playChime();

      const desktop = decideDesktopAlert({
        prefs,
        permission: typeof Notification === 'undefined' ? null : Notification.permission,
        documentVisible,
      });

      if (desktop.show) {
        try {
          const notification = new Notification(content.title, {
            body: content.description,
            // Collapses repeat alerts for one thread instead of stacking them.
            tag: `crm-inbox-${message.conversation_id}`,
          });
          notification.onclick = () => {
            window.focus();
            router.push(content.href);
            notification.close();
          };
        } catch {
          // Some browsers throw when constructing without a service worker.
        }
      }
    },
    [router],
  );

  useEffect(() => {
    if (!organizationId) return;

    // Org scoping is the one server-side filter postgres_changes allows, so it
    // is spent here; direction and dedupe are decided in decideNotify. RLS on
    // inbox_messages is the real boundary — this filter is an optimisation.
    const channel = supabase
      .channel(`crm-new-mail-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inbox_messages',
          filter: `org_id=eq.${organizationId}`,
        },
        (payload: { new: IncomingMessage }) => announce(payload.new),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId, announce]);

  return null;
}
