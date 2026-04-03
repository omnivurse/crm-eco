'use client';

import { useEffect, useRef, useState } from 'react';

export function UnsavedFormGuard({ children }: { children: React.ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = formRef.current;
    if (!el) return;

    const handleChange = () => setIsDirty(true);
    el.addEventListener('input', handleChange);
    el.addEventListener('change', handleChange);
    return () => {
      el.removeEventListener('input', handleChange);
      el.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return (
    <div ref={formRef}>
      {children}
      {isDirty && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
          Unsaved changes — don&apos;t forget to save before leaving
        </div>
      )}
    </div>
  );
}
