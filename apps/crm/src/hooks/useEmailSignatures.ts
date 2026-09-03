'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  pickSignatureForCompose,
  type ComposerSignature,
} from '@/app/crm/inbox/_components/inbox-reply';

export type { ComposerSignature };

export function useEmailSignatures(purpose: 'reply' | 'new' | 'all' = 'all') {
  const [signatures, setSignatures] = useState<ComposerSignature[]>([]);
  const [signatureId, setSignatureId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch('/api/email/signatures');
        if (!response.ok) return;
        const data = await response.json();
        const rows = (data.signatures || []) as ComposerSignature[];
        if (cancelled) return;
        setSignatures(rows);
        const picked = pickSignatureForCompose(
          rows,
          purpose === 'all' ? 'new' : purpose,
        );
        if (picked) setSignatureId(picked.id);
      } catch (error) {
        console.error('Failed to load signatures:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [purpose]);

  const visible = useMemo(() => {
    if (purpose === 'all') return signatures;
    return signatures.filter((s) =>
      purpose === 'reply' ? s.include_in_replies !== false : s.include_in_new !== false,
    );
  }, [purpose, signatures]);

  const selected = visible.find((s) => s.id === signatureId) ?? null;

  return {
    signatures: visible,
    signatureId,
    setSignatureId,
    selectedSignature: selected,
    loadingSignatures: loading,
  };
}
