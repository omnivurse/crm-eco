import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch,
  Plus,
  Play,
  Pause,
  Edit,
  Trash2,
  Clock,
  Check,
  AlertCircle,
  Activity,
  Zap,
  Settings,
  Eye,
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  execution_count?: number;
}

interface WorkflowStats {
  total: number;
  active: number;
  paused: number;
  executions_today: number;
}

export function Workflows() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<WorkflowStats>({
    total: 0,
    active: 0,
    paused: 0,
    executions_today: 0,
  });

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('workflows')
        .select('*')
        .order('created_at', { ascending: false });

      const { count: executionCount } = await supabase
        .from('workflow_executions')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (data) {
        setWorkflows(data);
        setStats({
          total: data.length,
          active: data.filter(w => w.is_active).length,
          paused: data.filter(w => !w.is_active).length,
          executions_today: executionCount || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkflow = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('workflows')
        .update({ is_active: !currentState })
        .eq('id', id);

      if (error) throw error;

      const actionText = !currentState ? 'activated' : 'paused';
      showToast(`Workflow ${actionText} successfully`, 'success');

      fetchWorkflows();
    } catch (error) {
      console.error('Error toggling workflow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast(`Failed to toggle workflow: ${errorMessage}`, 'error');
    }
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow? This action cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showToast('Workflow deleted successfully', 'success');
      fetchWorkflows();
    } catch (error) {
      console.error('Error deleting workflow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast(`Failed to delete workflow: ${errorMessage}`, 'error');
    }
  };

  const handleCreateWorkflow = () => {
    navigate('/admin/workflows/new');
  };

  const handleEditWorkflow = (id: string) => {
    navigate(`/admin/workflows/${id}`);
  };

  const handleUseTemplate = (template: string) => {
    showToast(`Creating workflow from ${template} template...`, 'success');
    navigate(`/admin/workflows/new?template=${template}`);
  };

  const triggerIcons: Record<string, any> = {
    'ticket.created': Zap,
    'ticket.updated': Activity,
    'request.submitted': Check,
    'schedule.cron': Clock,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-neutral-500 dark:text-neutral-400">Loading workflows...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900 p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="championship-title text-4xl mb-2" data-text="Workflow Automation">
            Workflow Automation
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400">
            Create and manage automated workflows for ticket and request handling
          </p>
        </div>
        <button onClick={handleCreateWorkflow} className="neon-button">
          <Plus size={20} className="inline mr-2" />
          New Workflow
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <div className="stat-card">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <GitBranch className="text-white" size={28} />
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Total Workflows</p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <Play className="text-white" size={28} /></div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Active</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.active}</p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Pause className="text-white" size={28} />
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Paused</p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-white">{stats.paused}</p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-900 to-cyan-600 flex items-center justify-center">
              <Activity className="text-white" size={28} />
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Runs Today</p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-white">{stats.executions_today}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Templates */}
      <div className="glass-card p-8 mb-8">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
          <Zap className="text-primary-800" size={28} />
          Quick Start Templates
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 border-2 border-dashed border-primary-300 dark:border-primary-800 rounded-2xl hover:border-primary-600 dark:hover:border-primary-500 hover:shadow-lg transition-all cursor-pointer group">
            <Zap className="text-primary-800 dark:text-primary-500 mb-3" size={32} />
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-2">Auto-assign Tickets</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
              Automatically assign new tickets based on category and agent workload
            </p>
            <button
              onClick={() => handleUseTemplate('auto-assign')}
              className="text-sm text-primary-800 dark:text-primary-500 hover:text-primary-900 dark:hover:text-primary-300 font-medium"
            >
              Use Template
            </button>
          </div>

          <div className="p-4 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg hover:border-primary-600 dark:hover:border-primary-500 transition-colors cursor-pointer">
            <Clock className="text-success-600 dark:text-green-400 mb-3" size={32} />
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-2">SLA Escalation</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
              Escalate tickets approaching SLA breach to managers automatically
            </p>
            <button
              onClick={() => handleUseTemplate('sla-escalation')}
              className="text-sm text-primary-800 dark:text-primary-500 hover:text-primary-900 dark:hover:text-primary-300 font-medium"
            >
              Use Template
            </button>
          </div>

          <div className="p-4 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg hover:border-primary-600 dark:hover:border-primary-500 transition-colors cursor-pointer">
            <Activity className="text-orange-600 dark:text-orange-400 mb-3" size={32} />
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-2">Status Updates</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
              Send automated status updates to requesters at key milestones
            </p>
            <button
              onClick={() => handleUseTemplate('status-updates')}
              className="text-sm text-primary-800 dark:text-primary-500 hover:text-primary-900 dark:hover:text-primary-300 font-medium"
            >
              Use Template
            </button>
          </div>
        </div>
      </div>

      {/* Workflows List */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Your Workflows</h2>
        </div>

        {workflows.length === 0 ? (
          <div className="p-12 text-center">
            <GitBranch className="mx-auto text-neutral-400 mb-4" size={48} />
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">No workflows created yet</p>
            <button
              onClick={handleCreateWorkflow}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl transition-colors"
            >
              <Plus size={20} />
              Create Your First Workflow
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {workflows.map((workflow) => {
              const TriggerIcon = triggerIcons[workflow.trigger_type] || Zap;
              return (
                <div
                  key={workflow.id}
                  className="p-6 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-3 rounded-lg ${workflow.is_active ? 'bg-green-100 dark:bg-green-900/20' : 'bg-neutral-100 dark:bg-neutral-700'}`}>
                        <TriggerIcon
                          className={workflow.is_active ? 'text-success-600 dark:text-green-400' : 'text-neutral-600 dark:text-neutral-400'}
                          size={24}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-neutral-900 dark:text-white">{workflow.name}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            workflow.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
                          }`}>
                            {workflow.is_active ? 'Active' : 'Paused'}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                          {workflow.description || 'No description provided'}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            Trigger: {workflow.trigger_type.replace(/\./g, ' ')}
                          </span>
                          <span>
                            Created {format(new Date(workflow.created_at), 'MMM d, yyyy')}
                          </span>
                          {workflow.execution_count !== undefined && (
                            <span className="flex items-center gap-1">
                              <Activity size={14} />
                              {workflow.execution_count} runs
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => toggleWorkflow(workflow.id, workflow.is_active)}
                        className={`p-2 rounded-lg transition-colors ${
                          workflow.is_active
                            ? 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                            : 'text-success-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                        }`}
                        title={workflow.is_active ? 'Pause workflow' : 'Activate workflow'}
                      >
                        {workflow.is_active ? <Pause size={18} /> : <Play size={18} />}
                      </button>
                      <button
                        onClick={() => handleEditWorkflow(workflow.id)}
                        className="p-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-600 rounded-lg transition-colors"
                        title="Edit workflow"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleEditWorkflow(workflow.id)}
                        className="p-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-600 rounded-lg transition-colors"
                        title="Workflow settings"
                      >
                        <Settings size={18} />
                      </button>
                      <button
                        onClick={() => deleteWorkflow(workflow.id)}
                        className="p-2 text-accent-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete workflow"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
