'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WorkflowBuilder } from '@/components/automation';
import type { CrmModule } from '@/lib/crm/types';
import type { CrmWorkflow } from '@/lib/automation/types';
import { Loader2 } from 'lucide-react';

export default function NewWorkflowPage() {
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

  async function handleSave(workflow: Partial<CrmWorkflow>) {
    // This would call the API to create the workflow
    // For now, just navigate back
    console.log('Saving workflow:', workflow);
    router.push('/crm/settings/automations/workflows');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <WorkflowBuilder
      modules={modules}
      onSave={handleSave}
      onCancel={() => router.push('/crm/settings/automations/workflows')}
    />
  );
}
