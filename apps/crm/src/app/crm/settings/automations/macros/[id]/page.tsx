'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MacroBuilder } from '@/components/automation/MacroBuilder';
import type { CrmModule } from '@/lib/crm/types';
import type { CrmMacro } from '@/lib/automation/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EditMacroPage() {
  const router = useRouter();
  const params = useParams();
  const macroId = params.id as string;

  const [macro, setMacro] = useState<CrmMacro | null>(null);
  const [modules, setModules] = useState<CrmModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [macroId]);

  async function fetchData() {
    try {
      const [macroRes, modulesRes] = await Promise.all([
        fetch(`/api/automation/macros/${macroId}`),
        fetch('/api/crm/modules'),
      ]);

      if (!macroRes.ok) {
        const err = await macroRes.json();
        throw new Error(err.error || 'Failed to load macro');
      }

      const [macroData, modulesData] = await Promise.all([
        macroRes.json(),
        modulesRes.json(),
      ]);

      setMacro(macroData);
      setModules(modulesData || []);
    } catch (err) {
      console.error('Failed to fetch macro:', err);
      setError(err instanceof Error ? err.message : 'Failed to load macro');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(macroData: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/automation/macros/${macroId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(macroData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update macro');
      }

      toast.success('Macro updated successfully');
      router.push('/crm/settings/automations/macros');
    } catch (error) {
      console.error('Failed to save macro:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update macro');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !macro) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-red-500 mb-4">{error || 'Macro not found'}</p>
        <button
          onClick={() => router.push('/crm/settings/automations/macros')}
          className="text-teal-600 hover:underline"
        >
          Back to Macros
        </button>
      </div>
    );
  }

  return (
    <MacroBuilder
      macro={macro}
      modules={modules}
      onSave={handleSave}
      onCancel={() => router.push('/crm/settings/automations/macros')}
    />
  );
}
