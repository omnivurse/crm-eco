'use client';

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';
import { GizmoOrbButton, GizmoOrbFace } from './gizmo-orb';
import { GIZMO_OPEN_EVENT } from './gizmo-open';

export type GizmoChatCard = {
  kind: 'record' | 'place' | 'howto';
  title: string;
  subtitle?: string;
  href: string;
  module?: string;
  steps?: string[];
};

export type GizmoCompanionTip = {
  id: string;
  title: string;
  body: string;
  learnMoreHref?: string;
};

export type GizmoChatMessage = {
  id: string;
  role: 'user' | 'gizmo';
  text: string;
  cards?: GizmoChatCard[];
};

type ChatResponse = {
  reply: string;
  cards?: GizmoChatCard[];
  refused?: boolean;
};

async function postGizmoChat(
  chatUrl: string,
  payload: Record<string, unknown>,
): Promise<ChatResponse> {
  const res = await fetch(chatUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as ChatResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Gizmo could not answer.');
  }
  return data;
}

export function GizmoCompanion({
  chatUrl,
  pageLabel,
  pathname,
  tips = [],
  onDismissTip,
  onHide,
  onNavigate,
  hasUnreadTips = false,
  bottomClassName = 'bottom-4 right-4',
  enabled = true,
}: {
  chatUrl: string;
  pageLabel?: string | null;
  pathname?: string | null;
  tips?: GizmoCompanionTip[];
  onDismissTip?: (id: string) => void;
  onHide?: () => void;
  onNavigate?: (href: string) => void;
  hasUnreadTips?: boolean;
  bottomClassName?: string;
  enabled?: boolean;
}) {
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<GizmoChatMessage[]>([]);

  const ask = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || thinking) return;
      setError(null);
      setDraft('');
      const userMsg: GizmoChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: q,
      };
      setMessages((prev) => [...prev, userMsg]);
      setThinking(true);
      try {
        const data = await postGizmoChat(chatUrl, {
          query: q,
          pathname: pathname ?? undefined,
          pageTitle: pageLabel ?? undefined,
          pageTips: tips.map((t) => ({ id: t.id, title: t.title, body: t.body })),
        });
        setMessages((prev) => [
          ...prev,
          {
            id: `g-${Date.now()}`,
            role: 'gizmo',
            text: data.reply,
            cards: data.cards,
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gizmo could not answer.');
      } finally {
        setThinking(false);
        queueMicrotask(() => inputRef.current?.focus());
      }
    },
    [chatUrl, pageLabel, pathname, tips, thinking],
  );

  useEffect(() => {
    const onOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<{ query?: string }>).detail;
      setOpen(true);
      if (detail?.query) {
        void ask(detail.query);
      } else {
        queueMicrotask(() => inputRef.current?.focus());
      }
    };
    window.addEventListener(GIZMO_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(GIZMO_OPEN_EVENT, onOpen);
  }, [ask]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(draft);
  };

  const trapTab = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const nodes = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!enabled) return null;

  const tree = (
    <div className={cn('fixed z-[80] flex flex-col items-end gap-2', bottomClassName)}>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Gizmo"
          aria-modal="false"
          onKeyDown={trapTab}
          className="flex max-h-[min(72vh,560px)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b1f1e]/92 text-teal-50 shadow-2xl backdrop-blur-xl"
        >
          <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <GizmoOrbFace thinking={thinking} className="h-8 w-8 scale-75" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-none">Gizmo</p>
              {pageLabel ? (
                <p className="mt-0.5 truncate text-[11px] text-teal-200/70">{pageLabel}</p>
              ) : null}
            </div>
            {onHide ? (
              <button
                type="button"
                onClick={onHide}
                className="rounded px-1.5 py-1 text-[11px] text-teal-200/70 hover:bg-white/5 hover:text-teal-50"
              >
                Hide
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-1.5 py-1 text-[11px] text-teal-200/70 hover:bg-white/5 hover:text-teal-50"
            >
              Close
            </button>
          </header>

          {tips.length > 0 ? (
            <div className="border-b border-white/10 px-3 py-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-teal-200/60">
                On this page
              </p>
              <div className="flex flex-col gap-1">
                {tips.slice(0, 3).map((tip) => (
                  <div
                    key={tip.id}
                    className="flex items-start justify-between gap-2 rounded-lg bg-white/5 px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-teal-50">{tip.title}</p>
                      <p className="text-[11px] leading-snug text-teal-100/70">{tip.body}</p>
                    </div>
                    {onDismissTip ? (
                      <button
                        type="button"
                        onClick={() => onDismissTip(tip.id)}
                        className="shrink-0 text-[10px] text-teal-200/60 hover:text-teal-50"
                        aria-label={`Dismiss ${tip.title}`}
                      >
                        Dismiss
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
            {messages.length === 0 && !thinking ? (
              <p className="text-sm text-teal-100/70">
                Ask me to find a record, a page, or a how-to in this workspace.
              </p>
            ) : null}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'rounded-xl px-2.5 py-2 text-sm',
                  m.role === 'user' ? 'ml-8 bg-teal-700/40' : 'mr-4 bg-white/5',
                )}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.cards?.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {m.cards.map((card) => (
                      <li
                        key={`${card.kind}-${card.href}-${card.title}`}
                        className="rounded-lg border border-white/10 bg-black/20 p-2"
                      >
                        <p className="text-xs font-semibold">{card.title}</p>
                        {card.subtitle ? (
                          <p className="text-[11px] text-teal-100/60">{card.subtitle}</p>
                        ) : null}
                        {card.steps?.length ? (
                          <ol className="mt-1 list-decimal pl-4 text-[11px] text-teal-100/80">
                            {card.steps.map((s) => (
                              <li key={s}>{s}</li>
                            ))}
                          </ol>
                        ) : null}
                        <div className="mt-1.5 flex gap-2">
                          <button
                            type="button"
                            className="rounded bg-teal-500/90 px-2 py-0.5 text-[11px] font-medium text-teal-950"
                            onClick={() => {
                              if (onNavigate) onNavigate(card.href);
                              else window.location.assign(card.href);
                              setOpen(false);
                            }}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            className="rounded px-2 py-0.5 text-[11px] text-teal-100/80 hover:bg-white/5"
                            onClick={() => {
                              void navigator.clipboard?.writeText(card.href);
                            }}
                          >
                            Copy link
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
            {thinking ? (
              <p className="text-xs text-teal-200/70" aria-live="polite">
                Looking…
              </p>
            ) : null}
            {error ? (
              <p className="text-xs text-rose-300" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="border-t border-white/10 p-2">
            <label className="sr-only" htmlFor={`${panelId}-ask`}>
              Ask Gizmo
            </label>
            <input
              id={`${panelId}-ask`}
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask Gizmo to find anything…"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-teal-50 outline-none placeholder:text-teal-200/40 focus:ring-2 focus:ring-teal-400/60"
            />
          </form>
        </div>
      ) : null}

      <GizmoOrbButton
        open={open}
        thinking={thinking}
        hasUnread={hasUnreadTips}
        onClick={() => setOpen((v) => !v)}
      />

      <style>{`
        @keyframes gizmo-breathe {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.04); filter: brightness(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gizmo-orb-breathe { animation: none !important; }
        }
      `}</style>
    </div>
  );

  if (typeof document === 'undefined') return tree;
  return createPortal(tree, document.body);
}
