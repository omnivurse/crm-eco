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
import { isGizmoResetQuery } from '../lib/gizmo-reset';
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
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const res = await fetch(chatUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as ChatResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Gizmo could not answer.');
  }
  return data;
}

const FRESH_REPLY = 'Cleared. What should I find next?';

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
  const abortRef = useRef<AbortController | null>(null);

  const startFresh = useCallback((announce: boolean) => {
    abortRef.current?.abort();
    abortRef.current = null;
    setThinking(false);
    setError(null);
    setDraft('');
    setMessages(
      announce
        ? [
            {
              id: `g-fresh-${Date.now()}`,
              role: 'gizmo',
              text: FRESH_REPLY,
            },
          ]
        : [],
    );
    queueMicrotask(() => inputRef.current?.focus());
  }, []);

  const ask = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || thinking) return;
      if (isGizmoResetQuery(q)) {
        startFresh(true);
        return;
      }
      setError(null);
      setDraft('');
      const userMsg: GizmoChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: q,
      };
      setMessages((prev) => [...prev, userMsg]);
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setThinking(true);
      try {
        const data = await postGizmoChat(
          chatUrl,
          {
            query: q,
            pathname: pathname ?? undefined,
            pageTitle: pageLabel ?? undefined,
            pageTips: tips.map((t) => ({ id: t.id, title: t.title, body: t.body })),
          },
          ac.signal,
        );
        if (ac.signal.aborted) return;
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
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Gizmo could not answer.');
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
        setThinking(false);
        queueMicrotask(() => inputRef.current?.focus());
      }
    },
    [chatUrl, pageLabel, pathname, startFresh, tips, thinking],
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
          className="gizmo-panel flex max-h-[min(72vh,560px)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl"
        >
          <header className="gizmo-panel-head flex items-center gap-2 border-b px-3 py-2">
            <GizmoOrbFace thinking={thinking} className="h-8 w-8 scale-75" />
            <div className="min-w-0 flex-1">
              <p className="gizmo-title text-sm font-semibold leading-none">Gizmo</p>
              {pageLabel ? (
                <p className="gizmo-muted mt-0.5 truncate text-[11px]">{pageLabel}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => startFresh(false)}
              className="gizmo-ghost rounded px-1.5 py-1 text-[11px]"
              aria-label="New search"
            >
              New
            </button>
            {onHide ? (
              <button
                type="button"
                onClick={onHide}
                className="gizmo-ghost rounded px-1.5 py-1 text-[11px]"
              >
                Hide
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="gizmo-ghost rounded px-1.5 py-1 text-[11px]"
            >
              Close
            </button>
          </header>

          {tips.length > 0 ? (
            <div className="gizmo-panel-tips border-b px-3 py-2">
              <p className="gizmo-muted mb-1 text-[10px] font-semibold uppercase tracking-wide">
                On this page
              </p>
              <div className="flex flex-col gap-1">
                {tips.slice(0, 3).map((tip) => (
                  <div
                    key={tip.id}
                    className="gizmo-chip flex items-start justify-between gap-2 rounded-lg px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="gizmo-title text-xs font-medium">{tip.title}</p>
                      <p className="gizmo-soft text-[11px] leading-snug">{tip.body}</p>
                    </div>
                    {onDismissTip ? (
                      <button
                        type="button"
                        onClick={() => onDismissTip(tip.id)}
                        className="gizmo-ghost shrink-0 text-[10px]"
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
              <p className="gizmo-soft text-sm">
                Ask me to find a record, a page, or a how-to in this workspace.
              </p>
            ) : null}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'rounded-xl px-2.5 py-2 text-sm',
                  m.role === 'user' ? 'gizmo-bubble-user ml-8' : 'gizmo-bubble-gizmo mr-4',
                )}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.cards?.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {m.cards.map((card) => (
                      <li
                        key={`${card.kind}-${card.href}-${card.title}`}
                        className="gizmo-card rounded-lg p-2"
                      >
                        <p className="gizmo-title text-xs font-semibold">{card.title}</p>
                        {card.subtitle ? (
                          <p className="gizmo-muted text-[11px]">{card.subtitle}</p>
                        ) : null}
                        {card.steps?.length ? (
                          <ol className="gizmo-soft mt-1 list-decimal pl-4 text-[11px]">
                            {card.steps.map((s) => (
                              <li key={s}>{s}</li>
                            ))}
                          </ol>
                        ) : null}
                        <div className="mt-1.5 flex gap-2">
                          <button
                            type="button"
                            className="gizmo-open rounded px-2 py-0.5 text-[11px] font-medium"
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
                            className="gizmo-ghost rounded px-2 py-0.5 text-[11px]"
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
              <p className="gizmo-muted text-xs" aria-live="polite">
                Looking…
              </p>
            ) : null}
            {error ? (
              <p className="gizmo-alert text-xs" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="gizmo-panel-form border-t p-2">
            <label className="sr-only" htmlFor={`${panelId}-ask`}>
              Ask Gizmo
            </label>
            <input
              id={`${panelId}-ask`}
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                messages.length > 0
                  ? 'Ask another thing, or type clear…'
                  : 'Ask Gizmo to find anything…'
              }
              className="gizmo-field w-full rounded-xl px-3 py-2 text-sm"
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
    </div>
  );

  if (typeof document === 'undefined') return tree;
  return createPortal(tree, document.body);
}
