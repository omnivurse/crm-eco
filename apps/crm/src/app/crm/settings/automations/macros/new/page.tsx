'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MacroBuilder } from '@/components/automation/MacroBuilder';
import type { CrmModule } from '@/lib/crm/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function NewMacroPage() {
  const router = useRouter();
  const [modules, setModules] = useState<CrmModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModules();
  }, []);

  async function fetchModules() {
    try {
      const res = await fetch('/api/crm/modules');
      const data = await res.json();
      setModules(data || []);
    } catch (error) {
      console.error('Failed to fetch modules:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(macroData: Record<string, unknown>) {
    try {
      const res = await fetch('/api/automation/macros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(macroData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create macro');
      }

      toast.success('Macro created successfully');
      router.push('/crm/settings/automations/macros');
    } catch (error) {
      console.error('Failed to create macro:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create macro');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <MacroBuilder
      modules={modules}
      onSave={handleSave}
      onCancel={() => router.push('/crm/settings/automations/macros')}
    />
  );
}
