'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { WorkflowBuilder } from '@/components/automation';
import type { CrmModule } from '@/lib/crm/types';
import type { CrmWorkflow } from '@/lib/automation/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EditWorkflowPage() {
  const router = useRouter();
  const params = useParams();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = useState<CrmWorkflow | null>(null);
  const [modules, setModules] = useState<CrmModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [workflowId]);

  async function fetchData() {
    try {
      const [workflowRes, modulesRes] = await Promise.all([
        fetch(`/api/automation/workflows/${workflowId}`),
        fetch('/api/crm/modules'),
      ]);

      if (!workflowRes.ok) {
        const err = await workflowRes.json();
        throw new Error(err.error || 'Failed to load workflow');
      }

      const [workflowData, modulesData] = await Promise.all([
        workflowRes.json(),
        modulesRes.json(),
      ]);

      setWorkflow(workflowData);
      setModules(modulesData || []);
    } catch (err) {
      console.error('Failed to fetch workflow:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(updatedWorkflow: Partial<CrmWorkflow>) {
    try {
      const res = await fetch(`/api/automation/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updatedWorkflow.name,
          description: updatedWorkflow.description,
          trigger_type: updatedWorkflow.trigger_type,
          trigger_config: updatedWorkflow.trigger_config || {},
          conditions: updatedWorkflow.conditions,
          actions: updatedWorkflow.actions || [],
          is_enabled: updatedWorkflow.is_enabled,
          priority: updatedWorkflow.priority,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update workflow');
      }

      toast.success('Workflow updated successfully');
      router.push('/crm/settings/automations/workflows');
    } catch (error) {
      console.error('Failed to save workflow:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update workflow');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-red-500 mb-4">{error || 'Workflow not found'}</p>
        <button
          onClick={() => router.push('/crm/settings/automations/workflows')}
          className="text-teal-600 hover:underline"
        >
          Back to Workflows
        </button>
      </div>
    );
  }

  return (
    <WorkflowBuilder
      workflow={workflow}
      modules={modules}
      onSave={handleSave}
      onCancel={() => router.push('/crm/settings/automations/workflows')}
    />
  );
}
