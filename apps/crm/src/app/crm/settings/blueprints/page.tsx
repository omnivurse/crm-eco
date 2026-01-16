'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Textarea,
  Switch,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui';
import { Plus, Pencil, Trash2, GripVertical, ArrowRight, Check, X } from 'lucide-react';
import type { CrmBlueprint, BlueprintStage, BlueprintTransition } from '@/lib/blueprints/types';

interface Module {
  id: string;
  key: string;
  name: string;
}

interface Field {
  id: string;
  key: string;
  label: string;
}

export default function BlueprintsSettingsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [blueprints, setBlueprints] = useState<CrmBlueprint[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [fields, setFields] = useState<Record<string, Field[]>>({});
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');
  
  // Blueprint form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CrmBlueprint | null>(null);
  const [form, setForm] = useState({
    module_id: '',
    name: '',
    description: '',
    is_enabled: true,
    is_default: true,
    stages: [] as BlueprintStage[],
    transitions: [] as BlueprintTransition[],
  });
  
  // Stage editor
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<BlueprintStage | null>(null);
  const [stageForm, setStageForm] = useState({ key: '', label: '', color: '' });
  
  // Transition editor
  const [transitionDialogOpen, setTransitionDialogOpen] = useState(false);
  const [editingTransition, setEditingTransition] = useState<BlueprintTransition | null>(null);
  const [transitionForm, setTransitionForm] = useState({
    from: '',
    to: '',
    required_fields: [] as string[],
    requires_approval: false,
    require_reason: false,
  });

  // Load data
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;
      setOrgId(profile.organization_id);

      const [blueprintsRes, modulesRes] = await Promise.all([
        supabase.from('crm_blueprints').select('*').eq('org_id', profile.organization_id),
        supabase.from('crm_modules').select('id, key, name').eq('org_id', profile.organization_id).eq('is_enabled', true),
      ]);

      setBlueprints((blueprintsRes.data || []) as CrmBlueprint[]);
      setModules((modulesRes.data || []) as Module[]);
      
      // Load fields for each module
      const fieldsByModule: Record<string, Field[]> = {};
      for (const mod of modulesRes.data || []) {
        const { data: moduleFields } = await supabase
          .from('crm_fields')
          .select('id, key, label')
          .eq('module_id', mod.id);
        fieldsByModule[mod.id] = (moduleFields || []) as Field[];
      }
      setFields(fieldsByModule);
      
      setLoading(false);
    }

    loadData();
  }, [supabase]);

  // Blueprint CRUD
  const handleSaveBlueprint = async () => {
    const data = {
      org_id: orgId,
      module_id: form.module_id,
      name: form.name,
      description: form.description || null,
      is_enabled: form.is_enabled,
      is_default: form.is_default,
      stages: form.stages,
      transitions: form.transitions,
    };

    if (editing) {
      await supabase.from('crm_blueprints').update(data).eq('id', editing.id);
    } else {
      await supabase.from('crm_blueprints').insert(data);
    }

    const { data: updated } = await supabase.from('crm_blueprints').select('*').eq('org_id', orgId);
    setBlueprints((updated || []) as CrmBlueprint[]);
    setDialogOpen(false);
    setEditing(null);
  };

  const handleDeleteBlueprint = async (id: string) => {
    if (!confirm('Delete this blueprint?')) return;
    await supabase.from('crm_blueprints').delete().eq('id', id);
    setBlueprints(blueprints.filter(b => b.id !== id));
  };

  const openEditBlueprint = (blueprint: CrmBlueprint) => {
    setEditing(blueprint);
    setForm({
      module_id: blueprint.module_id,
      name: blueprint.name,
      description: blueprint.description || '',
      is_enabled: blueprint.is_enabled,
      is_default: blueprint.is_default,
      stages: blueprint.stages,
      transitions: blueprint.transitions,
    });
    setDialogOpen(true);
  };

  const openNewBlueprint = () => {
    setEditing(null);
    setForm({
      module_id: modules[0]?.id || '',
      name: '',
      description: '',
      is_enabled: true,
      is_default: true,
      stages: [],
      transitions: [],
    });
    setDialogOpen(true);
  };

  // Stage management
  const handleSaveStage = () => {
    const newStage: BlueprintStage = {
      key: stageForm.key || stageForm.label.toLowerCase().replace(/\s+/g, '_'),
      label: stageForm.label,
      order: editingStage ? editingStage.order : form.stages.length,
      color: stageForm.color || undefined,
    };

    if (editingStage) {
      setForm({
        ...form,
        stages: form.stages.map(s => s.key === editingStage.key ? newStage : s),
      });
    } else {
      setForm({
        ...form,
        stages: [...form.stages, newStage],
      });
    }

    setStageDialogOpen(false);
    setEditingStage(null);
  };

  const handleDeleteStage = (key: string) => {
    setForm({
      ...form,
      stages: form.stages.filter(s => s.key !== key),
      transitions: form.transitions.filter(t => t.from !== key && t.to !== key),
    });
  };

  // Transition management
  const handleSaveTransition = () => {
    const newTransition: BlueprintTransition = {
      from: transitionForm.from,
      to: transitionForm.to,
      required_fields: transitionForm.required_fields,
      actions: [],
      requires_approval: transitionForm.requires_approval,
      require_reason: transitionForm.require_reason,
    };

    if (editingTransition) {
      setForm({
        ...form,
        transitions: form.transitions.map(t => 
          t.from === editingTransition.from && t.to === editingTransition.to ? newTransition : t
        ),
      });
    } else {
      setForm({
        ...form,
        transitions: [...form.transitions, newTransition],
      });
    }

    setTransitionDialogOpen(false);
    setEditingTransition(null);
  };

  const handleDeleteTransition = (from: string, to: string) => {
    setForm({
      ...form,
      transitions: form.transitions.filter(t => !(t.from === from && t.to === to)),
    });
  };

  const getModuleName = (moduleId: string) => modules.find(m => m.id === moduleId)?.name || moduleId;
  const getStageLabel = (key: string) => form.stages.find(s => s.key === key)?.label || key;
  const getModuleFields = () => fields[form.module_id] || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Blueprints</h1>
        <p className="text-muted-foreground">
          Configure stage gating, transitions, and required fields for your CRM modules.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Blueprint Definitions</CardTitle>
            <CardDescription>
              Define stages and transitions for each module.
            </CardDescription>
          </div>
          <Button onClick={openNewBlueprint}>
            <Plus className="h-4 w-4 mr-2" />
            Add Blueprint
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Stages</TableHead>
                <TableHead>Transitions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blueprints.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No blueprints defined
                  </TableCell>
                </TableRow>
              ) : (
                blueprints.map((blueprint) => (
                  <TableRow key={blueprint.id}>
                    <TableCell className="font-medium">{blueprint.name}</TableCell>
                    <TableCell>{getModuleName(blueprint.module_id)}</TableCell>
                    <TableCell>{blueprint.stages.length} stages</TableCell>
                    <TableCell>{blueprint.transitions.length} transitions</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={blueprint.is_enabled ? 'default' : 'secondary'}>
                          {blueprint.is_enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        {blueprint.is_default && (
                          <Badge variant="outline">Default</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditBlueprint(blueprint)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteBlueprint(blueprint.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Blueprint Editor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Create'} Blueprint</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="stages">Stages ({form.stages.length})</TabsTrigger>
              <TabsTrigger value="transitions">Transitions ({form.transitions.length})</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Module</Label>
                  <Select value={form.module_id} onValueChange={(v) => setForm({ ...form, module_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select module" />
                    </SelectTrigger>
                    <SelectContent>
                      {modules.map((mod) => (
                        <SelectItem key={mod.id} value={mod.id}>{mod.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Blueprint Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Sales Pipeline"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe this blueprint..."
                />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_enabled}
                    onCheckedChange={(checked) => setForm({ ...form, is_enabled: checked })}
                  />
                  <Label>Enabled</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_default}
                    onCheckedChange={(checked) => setForm({ ...form, is_default: checked })}
                  />
                  <Label>Default for module</Label>
                </div>
              </div>
            </TabsContent>

            {/* Stages Tab */}
            <TabsContent value="stages" className="space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingStage(null);
                    setStageForm({ key: '', label: '', color: '' });
                    setStageDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stage
                </Button>
              </div>
              <div className="space-y-2">
                {form.stages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No stages defined</p>
                ) : (
                  form.stages
                    .sort((a, b) => a.order - b.order)
                    .map((stage) => (
                      <div
                        key={stage.key}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: stage.color || '#888' }}
                          />
                          <span className="font-medium">{stage.label}</span>
                          <span className="text-xs text-muted-foreground">({stage.key})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingStage(stage);
                              setStageForm({ key: stage.key, label: stage.label, color: stage.color || '' });
                              setStageDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteStage(stage.key)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </TabsContent>

            {/* Transitions Tab */}
            <TabsContent value="transitions" className="space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingTransition(null);
                    setTransitionForm({ from: '', to: '', required_fields: [], requires_approval: false, require_reason: false });
                    setTransitionDialogOpen(true);
                  }}
                  disabled={form.stages.length < 2}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transition
                </Button>
              </div>
              <div className="space-y-2">
                {form.transitions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No transitions defined</p>
                ) : (
                  form.transitions.map((transition, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{getStageLabel(transition.from)}</Badge>
                        <ArrowRight className="h-4 w-4" />
                        <Badge variant="outline">{getStageLabel(transition.to)}</Badge>
                        {transition.required_fields.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({transition.required_fields.length} required fields)
                          </span>
                        )}
                        {transition.requires_approval && (
                          <Badge variant="secondary">Approval</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingTransition(transition);
                            setTransitionForm({
                              from: transition.from,
                              to: transition.to,
                              required_fields: transition.required_fields,
                              requires_approval: transition.requires_approval || false,
                              require_reason: transition.require_reason || false,
                            });
                            setTransitionDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTransition(transition.from, transition.to)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBlueprint} disabled={!form.name || !form.module_id}>
              Save Blueprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Dialog */}
      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStage ? 'Edit' : 'Add'} Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={stageForm.label}
                onChange={(e) => setStageForm({ ...stageForm, label: e.target.value })}
                placeholder="e.g., Qualified"
              />
            </div>
            <div className="space-y-2">
              <Label>Key (optional)</Label>
              <Input
                value={stageForm.key}
                onChange={(e) => setStageForm({ ...stageForm, key: e.target.value })}
                placeholder="auto-generated from label"
              />
            </div>
            <div className="space-y-2">
              <Label>Color (optional)</Label>
              <Input
                type="color"
                value={stageForm.color || '#6366f1'}
                onChange={(e) => setStageForm({ ...stageForm, color: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveStage} disabled={!stageForm.label}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transition Dialog */}
      <Dialog open={transitionDialogOpen} onOpenChange={setTransitionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTransition ? 'Edit' : 'Add'} Transition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Stage</Label>
                <Select value={transitionForm.from} onValueChange={(v) => setTransitionForm({ ...transitionForm, from: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="*">Any Stage (*)</SelectItem>
                    {form.stages.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To Stage</Label>
                <Select value={transitionForm.to} onValueChange={(v) => setTransitionForm({ ...transitionForm, to: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {form.stages.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Required Fields</Label>
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                {getModuleFields().map((field) => (
                  <label key={field.key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={transitionForm.required_fields.includes(field.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setTransitionForm({
                            ...transitionForm,
                            required_fields: [...transitionForm.required_fields, field.key],
                          });
                        } else {
                          setTransitionForm({
                            ...transitionForm,
                            required_fields: transitionForm.required_fields.filter((f) => f !== field.key),
                          });
                        }
                      }}
                    />
                    <span>{field.label}</span>
                  </label>
                ))}
                {getModuleFields().length === 0 && (
                  <p className="text-sm text-muted-foreground">No fields defined for this module</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={transitionForm.requires_approval}
                  onCheckedChange={(checked) => setTransitionForm({ ...transitionForm, requires_approval: checked })}
                />
                <Label>Requires Approval</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={transitionForm.require_reason}
                  onCheckedChange={(checked) => setTransitionForm({ ...transitionForm, require_reason: checked })}
                />
                <Label>Require Reason</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransitionDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTransition} disabled={!transitionForm.from || !transitionForm.to}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
