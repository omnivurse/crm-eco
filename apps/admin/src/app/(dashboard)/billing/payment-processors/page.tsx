'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
} from '@crm-eco/ui';
import {
  CreditCard,
  Plus,
  Edit,
  Trash2,
  Building2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Shield,
  Eye,
  EyeOff,
  Settings,
  Star,
} from 'lucide-react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';

interface PaymentProcessor {
  id: string;
  name: string;
  processor_type: string;
  api_login_id: string;
  transaction_key: string;
  is_sandbox: boolean;
  is_active: boolean;
  is_default: boolean;
  supported_methods: string[];
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const PROCESSOR_TYPES = [
  { value: 'authorize_net', label: 'Authorize.Net' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'nmi', label: 'NMI' },
  { value: 'paypal', label: 'PayPal' },
];

const PAYMENT_METHODS = [
  { value: 'card', label: 'Credit/Debit Card' },
  { value: 'ach', label: 'ACH/Bank Transfer' },
  { value: 'paypal', label: 'PayPal' },
];

const emptyProcessor: Omit<PaymentProcessor, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  processor_type: 'authorize_net',
  api_login_id: '',
  transaction_key: '',
  is_sandbox: true,
  is_active: true,
  is_default: false,
  supported_methods: ['card'],
  settings: {},
};

export default function PaymentProcessorsPage() {
  const [processors, setProcessors] = useState<PaymentProcessor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingProcessor, setEditingProcessor] = useState<PaymentProcessor | null>(null);
  const [formData, setFormData] = useState(emptyProcessor);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showTransactionKey, setShowTransactionKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const supabase = createClient();

  const fetchProcessors = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('payment_processors')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      setProcessors(data || []);
    } catch (error) {
      console.error('Error fetching processors:', error);
      toast.error('Failed to load payment processors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcessors();
  }, []);

  const openCreateModal = () => {
    setEditingProcessor(null);
    setFormData(emptyProcessor);
    setShowApiKey(false);
    setShowTransactionKey(false);
    setShowModal(true);
  };

  const openEditModal = (processor: PaymentProcessor) => {
    setEditingProcessor(processor);
    setFormData({
      name: processor.name,
      processor_type: processor.processor_type,
      api_login_id: processor.api_login_id,
      transaction_key: '', // Don't pre-fill sensitive data
      is_sandbox: processor.is_sandbox,
      is_active: processor.is_active,
      is_default: processor.is_default,
      supported_methods: processor.supported_methods || ['card'],
      settings: processor.settings || {},
    });
    setShowApiKey(false);
    setShowTransactionKey(false);
    setShowModal(true);
  };

  const openDeleteModal = (processor: PaymentProcessor) => {
    setEditingProcessor(processor);
    setShowDeleteModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.api_login_id.trim()) {
      toast.error('API Login ID is required');
      return;
    }
    if (!editingProcessor && !formData.transaction_key.trim()) {
      toast.error('Transaction Key is required');
      return;
    }

    setSaving(true);
    try {
      const saveData: Record<string, unknown> = {
        name: formData.name,
        processor_type: formData.processor_type,
        api_login_id: formData.api_login_id,
        is_sandbox: formData.is_sandbox,
        is_active: formData.is_active,
        is_default: formData.is_default,
        supported_methods: formData.supported_methods,
        settings: formData.settings,
      };

      // Only include transaction_key if provided (for updates, it's optional)
      if (formData.transaction_key.trim()) {
        saveData.transaction_key = formData.transaction_key;
      }

      const sb = supabase as any;

      if (editingProcessor) {
        // Update existing
        const { error } = await sb
          .from('payment_processors')
          .update(saveData)
          .eq('id', editingProcessor.id);

        if (error) throw error;

        // Log to audit
        await sb.from('billing_audit_log').insert({
          action: 'processor_updated',
          entity_type: 'payment_processor',
          entity_id: editingProcessor.id,
          details: {
            name: formData.name,
            processor_type: formData.processor_type,
            is_sandbox: formData.is_sandbox,
            is_active: formData.is_active,
          },
        });

        toast.success('Payment processor updated');
      } else {
        // Create new
        const { data, error } = await sb
          .from('payment_processors')
          .insert(saveData)
          .select()
          .single();

        if (error) throw error;

        // Log to audit
        await sb.from('billing_audit_log').insert({
          action: 'processor_created',
          entity_type: 'payment_processor',
          entity_id: data.id,
          details: {
            name: formData.name,
            processor_type: formData.processor_type,
            is_sandbox: formData.is_sandbox,
          },
        });

        toast.success('Payment processor created');
      }

      // If this processor is set as default, unset others
      if (formData.is_default) {
        const currentId = editingProcessor?.id;
        await sb
          .from('payment_processors')
          .update({ is_default: false })
          .neq('id', currentId || '');
      }

      setShowModal(false);
      fetchProcessors();
    } catch (error) {
      console.error('Error saving processor:', error);
      toast.error('Failed to save payment processor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingProcessor) return;

    setDeleting(true);
    try {
      const sb = supabase as any;
      const { error } = await sb
        .from('payment_processors')
        .delete()
        .eq('id', editingProcessor.id);

      if (error) throw error;

      // Log to audit
      await sb.from('billing_audit_log').insert({
        action: 'processor_deleted',
        entity_type: 'payment_processor',
        entity_id: editingProcessor.id,
        details: {
          name: editingProcessor.name,
          processor_type: editingProcessor.processor_type,
        },
      });

      toast.success('Payment processor deleted');
      setShowDeleteModal(false);
      fetchProcessors();
    } catch (error) {
      console.error('Error deleting processor:', error);
      toast.error('Failed to delete payment processor');
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (processor: PaymentProcessor) => {
    try {
      const sb = supabase as any;
      const { error } = await sb
        .from('payment_processors')
        .update({ is_active: !processor.is_active })
        .eq('id', processor.id);

      if (error) throw error;

      // Log to audit
      await sb.from('billing_audit_log').insert({
        action: processor.is_active ? 'processor_deactivated' : 'processor_activated',
        entity_type: 'payment_processor',
        entity_id: processor.id,
        details: { name: processor.name },
      });

      toast.success(`Processor ${processor.is_active ? 'deactivated' : 'activated'}`);
      fetchProcessors();
    } catch (error) {
      console.error('Error toggling processor:', error);
      toast.error('Failed to update processor');
    }
  };

  const setAsDefault = async (processor: PaymentProcessor) => {
    try {
      const sb = supabase as any;
      // Unset all defaults first
      await sb.from('payment_processors').update({ is_default: false }).neq('id', processor.id);

      // Set this one as default
      const { error } = await sb
        .from('payment_processors')
        .update({ is_default: true })
        .eq('id', processor.id);

      if (error) throw error;

      // Log to audit
      await sb.from('billing_audit_log').insert({
        action: 'processor_set_default',
        entity_type: 'payment_processor',
        entity_id: processor.id,
        details: { name: processor.name },
      });

      toast.success(`${processor.name} is now the default processor`);
      fetchProcessors();
    } catch (error) {
      console.error('Error setting default:', error);
      toast.error('Failed to set default processor');
    }
  };

  const maskKey = (key: string) => {
    if (!key) return '••••••••';
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••' + key.substring(key.length - 4);
  };

  const getProcessorIcon = (type: string) => {
    switch (type) {
      case 'authorize_net':
        return <CreditCard className="h-5 w-5" />;
      case 'stripe':
        return <CreditCard className="h-5 w-5" />;
      case 'nmi':
        return <Building2 className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  const toggleMethod = (method: string) => {
    const methods = formData.supported_methods || [];
    if (methods.includes(method)) {
      setFormData({ ...formData, supported_methods: methods.filter((m) => m !== method) });
    } else {
      setFormData({ ...formData, supported_methods: [...methods, method] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment Processors</h1>
          <p className="text-muted-foreground">Configure payment gateway integrations</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Add Processor
        </Button>
      </div>

      {/* Processors List */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse flex items-center gap-4">
                  <div className="h-12 w-12 bg-slate-100 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-slate-100 rounded" />
                    <div className="h-3 w-32 bg-slate-100 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : processors.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-lg font-medium">No Payment Processors</p>
              <p className="text-sm text-muted-foreground mb-4">
                Add a payment processor to start accepting payments
              </p>
              <Button onClick={openCreateModal}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Processor
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {processors.map((processor) => (
            <Card key={processor.id} className={processor.is_default ? 'border-teal-500 border-2' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-lg ${
                        processor.is_active ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {getProcessorIcon(processor.processor_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{processor.name}</h3>
                        {processor.is_default && (
                          <Badge className="bg-teal-100 text-teal-700">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                        {processor.is_sandbox && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            Sandbox
                          </Badge>
                        )}
                        {processor.is_active ? (
                          <Badge variant="default" className="bg-emerald-100 text-emerald-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {PROCESSOR_TYPES.find((t) => t.value === processor.processor_type)?.label || processor.processor_type}
                      </p>
                      <div className="flex items-center gap-4 mt-3">
                        <div>
                          <p className="text-xs text-muted-foreground">API Login ID</p>
                          <p className="text-sm font-mono">{maskKey(processor.api_login_id)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Transaction Key</p>
                          <p className="text-sm font-mono">••••••••</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Payment Methods</p>
                          <div className="flex gap-1 mt-1">
                            {processor.supported_methods?.map((method) => (
                              <Badge key={method} variant="outline" className="text-xs">
                                {method}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!processor.is_default && processor.is_active && (
                      <Button variant="outline" size="sm" onClick={() => setAsDefault(processor)}>
                        <Star className="h-4 w-4 mr-1" />
                        Set Default
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => toggleActive(processor)}>
                      {processor.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditModal(processor)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => openDeleteModal(processor)}
                      disabled={processor.is_default}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Security Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Security Information</p>
              <p className="text-sm text-blue-700 mt-1">
                API credentials are encrypted at rest and never displayed in full. Transaction keys must be re-entered
                when editing a processor. All changes to payment processors are logged for audit purposes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProcessor ? 'Edit Payment Processor' : 'Add Payment Processor'}</DialogTitle>
            <DialogDescription>
              Configure your payment gateway credentials. All sensitive data is encrypted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                placeholder="e.g., Primary Gateway"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="processor_type">Processor Type</Label>
              <select
                id="processor_type"
                className="w-full border rounded-md px-3 py-2"
                value={formData.processor_type}
                onChange={(e) => setFormData({ ...formData, processor_type: e.target.value })}
              >
                {PROCESSOR_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api_login_id">API Login ID</Label>
              <div className="relative">
                <Input
                  id="api_login_id"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="Enter API Login ID"
                  value={formData.api_login_id}
                  onChange={(e) => setFormData({ ...formData, api_login_id: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transaction_key">
                Transaction Key {editingProcessor && '(leave blank to keep existing)'}
              </Label>
              <div className="relative">
                <Input
                  id="transaction_key"
                  type={showTransactionKey ? 'text' : 'password'}
                  placeholder={editingProcessor ? '••••••••' : 'Enter Transaction Key'}
                  value={formData.transaction_key}
                  onChange={(e) => setFormData({ ...formData, transaction_key: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setShowTransactionKey(!showTransactionKey)}
                >
                  {showTransactionKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Supported Payment Methods</Label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <Badge
                    key={method.value}
                    variant={formData.supported_methods?.includes(method.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleMethod(method.value)}
                  >
                    {method.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="is_sandbox">Sandbox Mode</Label>
                <p className="text-sm text-muted-foreground">Use test/sandbox environment</p>
              </div>
              <Switch
                id="is_sandbox"
                checked={formData.is_sandbox}
                onCheckedChange={(checked) => setFormData({ ...formData, is_sandbox: checked })}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="is_active">Active</Label>
                <p className="text-sm text-muted-foreground">Enable this processor for transactions</p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="is_default">Default Processor</Label>
                <p className="text-sm text-muted-foreground">Use this processor by default</p>
              </div>
              <Switch
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Processor'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Payment Processor</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this payment processor? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {editingProcessor && (
            <div className="py-4">
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-900">{editingProcessor.name}</p>
                    <p className="text-sm text-red-700">
                      {PROCESSOR_TYPES.find((t) => t.value === editingProcessor.processor_type)?.label}
                    </p>
                  </div>
                </div>
              </div>
              {editingProcessor.is_default && (
                <p className="text-sm text-amber-600 mt-3">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  This is the default processor and cannot be deleted. Please set another processor as default first.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || editingProcessor?.is_default}
            >
              {deleting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Processor
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
