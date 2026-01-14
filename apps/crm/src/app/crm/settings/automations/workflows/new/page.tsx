'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WorkflowBuilder } from '@/components/automation';
import type { CrmModule } from '@/lib/crm/types';
import type { CrmWorkflow } from '@/lib/automation/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
    try {
      const res = await fetch('/api/automation/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_id: workflow.module_id,
          name: workflow.name,
          description: workflow.description,
          trigger_type: workflow.trigger_type,
          trigger_config: workflow.trigger_config || {},
          conditions: workflow.conditions,
          actions: workflow.actions || [],
          is_enabled: workflow.is_enabled ?? true,
          priority: workflow.priority || 100,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create workflow');
      }

      toast.success('Workflow created successfully');
      router.push('/crm/settings/automations/workflows');
    } catch (error) {
      console.error('Failed to save workflow:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create workflow');
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
    <WorkflowBuilder
      modules={modules}
      onSave={handleSave}
      onCancel={() => router.push('/crm/settings/automations/workflows')}
    />
  );
}
