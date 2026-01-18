'use client';

import { useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { ArrowLeft, Save, Play, Pause, Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { WorkflowCanvas } from '@/components/workflows/WorkflowCanvas';
import { WorkflowSidebar } from '@/components/workflows/WorkflowSidebar';
import type { WorkflowNode, WorkflowEdge, NodeType, WorkflowStatus } from '@/lib/workflows/types';

function generateId() {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function WorkflowBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workflowId = searchParams.get('id');

  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>('draft');
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameDialogOpen, setNameDialogOpen] = useState(!workflowId);
  const [tempName, setTempName] = useState('');

  // Add new node from palette
  const handleAddNode = useCallback((type: NodeType, label: string) => {
    const newNode: WorkflowNode = {
      id: generateId(),
      type,
      label,
      position: {
        x: 100 + nodes.length * 50,
        y: 100 + nodes.length * 50,
      },
      config: {},
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  }, [nodes.length]);

  // Update node position or config
  const handleUpdateNode = useCallback((id: string, updates: Partial<WorkflowNode>) => {
    setNodes(prev =>
      prev.map(node =>
        node.id === id ? { ...node, ...updates } : node
      )
    );
  }, []);

  // Delete node
  const handleDeleteNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(node => node.id !== id));
    setEdges(prev => prev.filter(edge => edge.source !== id && edge.target !== id));
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId]);

  // Add edge between nodes
  const handleAddEdge = useCallback((source: string, target: string) => {
    // Check if edge already exists
    const exists = edges.some(e => e.source === source && e.target === target);
    if (exists) return;

    const newEdge: WorkflowEdge = {
      id: `edge_${source}_${target}`,
      source,
      target,
    };

    setEdges(prev => [...prev, newEdge]);
  }, [edges]);

  // Delete edge
  const handleDeleteEdge = useCallback((id: string) => {
    setEdges(prev => prev.filter(edge => edge.id !== id));
  }, []);

  // Save workflow
  const handleSave = async () => {
    if (!workflowName.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }

    // Validate workflow has at least one trigger
    const hasTrigger = nodes.some(n => n.type.startsWith('trigger_'));
    if (!hasTrigger) {
      toast.error('Workflow must have at least one trigger');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: workflowName,
        nodes,
        edges,
        status: workflowStatus,
      };

      const url = workflowId
        ? `/api/workflows/${workflowId}`
        : '/api/workflows';

      const response = await fetch(url, {
        method: workflowId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save workflow');
      }

      const data = await response.json();
      toast.success('Workflow saved');

      if (!workflowId) {
        router.push(`/crm/settings/automations/workflows/builder?id=${data.id}`);
      }
    } catch (error) {
      toast.error('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  // Toggle workflow status
  const handleToggleStatus = async () => {
    const newStatus = workflowStatus === 'active' ? 'paused' : 'active';

    if (newStatus === 'active' && nodes.length === 0) {
      toast.error('Add nodes before activating');
      return;
    }

    setWorkflowStatus(newStatus);
    toast.success(`Workflow ${newStatus === 'active' ? 'activated' : 'paused'}`);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <Link href="/crm/settings/automations">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <button
              onClick={() => {
                setTempName(workflowName);
                setNameDialogOpen(true);
              }}
              className="font-semibold text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              {workflowName}
            </button>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                workflowStatus === 'active'
                  ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                  : workflowStatus === 'paused'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {workflowStatus.charAt(0).toUpperCase() + workflowStatus.slice(1)}
              </span>
              <span className="text-xs text-slate-500">
                {nodes.length} nodes · {edges.length} connections
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {workflowStatus === 'active' ? (
            <Button variant="outline" onClick={handleToggleStatus}>
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          ) : (
            <Button variant="outline" onClick={handleToggleStatus}>
              <Play className="w-4 h-4 mr-2" />
              Activate
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <WorkflowSidebar onAddNode={handleAddNode} />

        {/* Canvas */}
        <div className="flex-1 relative">
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onAddEdge={handleAddEdge}
            onDeleteEdge={handleDeleteEdge}
          />
        </div>

        {/* Node Config Panel */}
        {selectedNodeId && (
          <div className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Configure Node
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedNodeId(null)}
              >
                Close
              </Button>
            </div>

            {(() => {
              const node = nodes.find(n => n.id === selectedNodeId);
              if (!node) return null;

              return (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Label
                    </label>
                    <Input
                      value={node.label}
                      onChange={(e) => handleUpdateNode(node.id, { label: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Node Type: <span className="font-medium">{node.type}</span>
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Position: ({Math.round(node.position.x)}, {Math.round(node.position.y)})
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                    <p className="text-sm text-slate-500">
                      Advanced configuration options coming soon.
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Name Dialog */}
      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workflow Name</DialogTitle>
            <DialogDescription>
              Enter a name for your workflow
            </DialogDescription>
          </DialogHeader>
          <Input
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            placeholder="e.g., Lead Follow-up Workflow"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (tempName.trim()) {
                  setWorkflowName(tempName.trim());
                }
                setNameDialogOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function WorkflowBuilderPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    }>
      <WorkflowBuilderContent />
    </Suspense>
  );
}
