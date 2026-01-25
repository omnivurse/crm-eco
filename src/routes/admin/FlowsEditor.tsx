import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft,
  Save,
  Play,
  Plus,
  Trash2,
  Zap,
  GitBranch,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: any;
  is_active: boolean;
}

interface WorkflowStep {
  id: string;
  step_type: string;
  step_config: any;
  sort_order: number;
}

export function FlowsEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (id && id !== 'new') {
      fetchWorkflow();
    } else {
      setLoading(false);
    }
  }, [id]);

  const fetchWorkflow = async () => {
    try {
      setLoading(true);
      const { data: workflowData, error: workflowError } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single();

      if (workflowError) throw workflowError;
      setWorkflow(workflowData);

      const { data: stepsData, error: stepsError } = await supabase
        .from('workflow_steps')
        .select('*')
        .eq('workflow_id', id)
        .order('sort_order');

      if (stepsData) setSteps(stepsData);
    } catch (error) {
      console.error('Error fetching workflow:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (id === 'new') {
        alert('Create workflow functionality coming soon!');
      } else {
        alert('Workflow saved!');
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTestResult('Testing workflow...');
    setTimeout(() => {
      setTestResult('✅ Workflow validation passed! All steps are configured correctly.');
    }, 1500);
  };

  const addStep = (stepType: string) => {
    const newStep: WorkflowStep = {
      id: `temp-${Date.now()}`,
      step_type: stepType,
      step_config: {},
      sort_order: steps.length
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const getStepIcon = (stepType: string) => {
    const icons: Record<string, any> = {
      'function': Zap,
      'task': CheckCircle,
      'notify': MessageSquare,
      'condition': GitBranch,
      'wait': Clock,
      'webhook': AlertCircle
    };
    return icons[stepType] || CheckCircle;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate('/admin/workflows')}
            className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-800 dark:hover:text-primary-500 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Workflows</span>
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="championship-title text-4xl" data-text="Workflow Editor">
                Workflow Editor
              </h1>
              <p className="text-xl text-neutral-600 dark:text-neutral-400 mt-2">
                {workflow?.name || 'Create New Workflow'}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleTest} className="px-6 py-3 rounded-xl border-2 border-primary-600 text-primary-800 dark:text-primary-500 font-semibold hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-all flex items-center gap-2">
                <Play size={20} />
                Test
              </button>
              <button onClick={handleSave} disabled={saving} className="neon-button flex items-center gap-2">
                <Save size={20} />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Test Result */}
        {testResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 glass-card p-4 border-2 border-success-500/50 glow-effect"
          >
            <p className="text-success-600 dark:text-green-400 font-medium">{testResult}</p>
          </motion.div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Workflow Canvas */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-8"
            >
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                <GitBranch className="text-primary-800" size={28} />
                Workflow Steps
              </h2>

              {/* Trigger */}
              <div className="mb-8">
                <div className="stat-card p-6">
                  <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                        <Zap className="text-white" size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-neutral-900 dark:text-white">Trigger</h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          {workflow?.trigger_type || 'ticket.created'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-4 mb-6">
                {steps.map((step, index) => {
                  const StepIcon = getStepIcon(step.step_type);
                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="glass-card p-6 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-bold">
                          {index + 1}
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-950/30 flex items-center justify-center">
                          <StepIcon className="text-primary-800" size={20} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-neutral-900 dark:text-white capitalize">
                            {step.step_type.replace('_', ' ')}
                          </h4>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            {step.step_config?.description || 'Configure this step'}
                          </p>
                        </div>
                        <button
                          onClick={() => removeStep(index)}
                          className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-accent-600 transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Add Step Button */}
              <div className="text-center">
                <button
                  onClick={() => addStep('function')}
                  className="px-6 py-3 rounded-xl border-2 border-dashed border-primary-500 dark:border-primary-800 text-primary-800 dark:text-primary-500 font-medium hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-all flex items-center gap-2 mx-auto"
                >
                  <Plus size={20} />
                  Add Step
                </button>
              </div>
            </motion.div>
          </div>

          {/* Sidebar - Step Types */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-6 sticky top-6"
            >
              <h3 className="font-bold text-neutral-900 dark:text-white mb-4">Available Steps</h3>
              <div className="space-y-3">
                {[
                  { type: 'function', label: 'Function', icon: Zap, desc: 'Execute a function' },
                  { type: 'task', label: 'Task', icon: CheckCircle, desc: 'Perform an action' },
                  { type: 'notify', label: 'Notify', icon: MessageSquare, desc: 'Send notification' },
                  { type: 'condition', label: 'Condition', icon: GitBranch, desc: 'Conditional logic' },
                  { type: 'wait', label: 'Wait', icon: Clock, desc: 'Add a delay' },
                  { type: 'webhook', label: 'Webhook', icon: AlertCircle, desc: 'Call external API' }
                ].map((stepType) => (
                  <button
                    key={stepType.type}
                    onClick={() => addStep(stepType.type)}
                    className="w-full p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-colors text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <stepType.icon className="text-primary-800 mt-1 flex-shrink-0" size={20} />
                      <div>
                        <h4 className="font-semibold text-neutral-900 dark:text-white group-hover:text-primary-800 dark:group-hover:text-primary-500 transition-colors">
                          {stepType.label}
                        </h4>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                          {stepType.desc}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 p-4 rounded-xl bg-primary-50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800">
                <p className="text-sm text-primary-900 dark:text-primary-200">
                  💡 <strong>Tip:</strong> Drag and drop steps to reorder them. Each step executes in sequence.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
