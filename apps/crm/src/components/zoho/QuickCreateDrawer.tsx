'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@crm-eco/ui/components/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Users,
  UserPlus,
  DollarSign,
  Building2,
  Loader2,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

type ModuleType = 'contacts' | 'leads' | 'deals' | 'accounts';

interface QuickCreateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultModule?: ModuleType;
}

const MODULE_CONFIG: Record<ModuleType, {
  name: string;
  namePlural: string;
  icon: React.ReactNode;
  color: string;
  fields: { key: string; label: string; type: string; required?: boolean }[];
}> = {
  contacts: {
    name: 'Contact',
    namePlural: 'Contacts',
    icon: <Users className="w-5 h-5" />,
    color: 'text-teal-600 dark:text-teal-400',
    fields: [
      { key: 'first_name', label: 'First Name', type: 'text', required: true },
      { key: 'last_name', label: 'Last Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
    ],
  },
  leads: {
    name: 'Lead',
    namePlural: 'Leads',
    icon: <UserPlus className="w-5 h-5" />,
    color: 'text-violet-600 dark:text-violet-400',
    fields: [
      { key: 'first_name', label: 'First Name', type: 'text', required: true },
      { key: 'last_name', label: 'Last Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'company', label: 'Company', type: 'text' },
    ],
  },
  deals: {
    name: 'Deal',
    namePlural: 'Deals',
    icon: <DollarSign className="w-5 h-5" />,
    color: 'text-emerald-600 dark:text-emerald-400',
    fields: [
      { key: 'title', label: 'Deal Name', type: 'text', required: true },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'close_date', label: 'Close Date', type: 'date' },
    ],
  },
  accounts: {
    name: 'Account',
    namePlural: 'Accounts',
    icon: <Building2 className="w-5 h-5" />,
    color: 'text-amber-600 dark:text-amber-400',
    fields: [
      { key: 'name', label: 'Account Name', type: 'text', required: true },
      { key: 'website', label: 'Website', type: 'url' },
      { key: 'industry', label: 'Industry', type: 'text' },
    ],
  },
};

export function QuickCreateDrawer({
  open,
  onOpenChange,
  defaultModule = 'leads',
}: QuickCreateDrawerProps) {
  const router = useRouter();
  const [selectedModule, setSelectedModule] = useState<ModuleType>(defaultModule);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const config = MODULE_CONFIG[selectedModule];

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleModuleChange = (module: ModuleType) => {
    setSelectedModule(module);
    setFormData({});
  };

  const handleSubmit = async () => {
    // Validate required fields
    const missingFields = config.fields
      .filter(f => f.required && !formData[f.key]?.trim())
      .map(f => f.label);

    if (missingFields.length > 0) {
      toast.error(`Please fill in: ${missingFields.join(', ')}`);
      return;
    }

    setSubmitting(true);

    try {
      // Get module ID
      const { data: module } = await supabase
        .from('crm_modules')
        .select('id')
        .eq('key', selectedModule)
        .single();

      if (!module) throw new Error('Module not found');

      // Build title
      let title = formData.title;
      if (!title && (formData.first_name || formData.last_name)) {
        title = [formData.first_name, formData.last_name].filter(Boolean).join(' ');
      }
      if (!title && formData.name) {
        title = formData.name;
      }

      // Create record
      const { data: record, error } = await supabase
        .from('crm_records')
        .insert({
          module_id: module.id,
          title,
          email: formData.email || null,
          phone: formData.phone || null,
          data: formData,
        })
        .select('id')
        .single();

      if (error) throw error;

      toast.success(`${config.name} created successfully`);
      
      // Navigate to the new record
      router.push(`/crm/r/${record.id}`);
      onOpenChange(false);
      setFormData({});
    } catch (error) {
      console.error('Error creating record:', error);
      toast.error('Failed to create record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onOpenChange(false);
      setFormData({});
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10"
      >
        <SheetHeader className="p-6 border-b border-slate-200 dark:border-white/10">
          <SheetTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Plus className="w-5 h-5" />
            Quick Create
          </SheetTitle>
          <SheetDescription className="text-slate-500">
            Create a new record quickly
          </SheetDescription>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* Module Selector */}
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300">Record Type</Label>
            <Select value={selectedModule} onValueChange={(v) => handleModuleChange(v as ModuleType)}>
              <SelectTrigger className="h-10 bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                {(Object.entries(MODULE_CONFIG) as [ModuleType, typeof config][]).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <span className={cfg.color}>{cfg.icon}</span>
                      <span>{cfg.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Fields */}
          <div className="space-y-4">
            {config.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </Label>
                <Input
                  type={field.type}
                  value={formData[field.key] || ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  className="h-10 bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10"
                />
              </div>
            ))}
          </div>
        </div>

        <SheetFooter className="p-6 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 border-slate-200 dark:border-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Create {config.name}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
