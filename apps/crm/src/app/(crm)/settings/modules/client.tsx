'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Switch } from '@crm-eco/ui/components/switch';
import { Badge } from '@crm-eco/ui/components/badge';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@crm-eco/ui/components/dialog';
import type { CrmModule, CrmProfile } from '@/lib/crm/types';
import {
  ArrowLeft,
  Plus,
  GripVertical,
  Settings,
  Users,
  UserPlus,
  DollarSign,
  Building,
  FileText,
} from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  user: Users,
  'user-plus': UserPlus,
  'dollar-sign': DollarSign,
  building: Building,
  file: FileText,
};

interface ModulesSettingsClientProps {
  modules: CrmModule[];
  profile: CrmProfile;
}

export function ModulesSettingsClient({ modules: initialModules, profile }: ModulesSettingsClientProps) {
  const [modules, setModules] = useState(initialModules);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleKey, setNewModuleKey] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleToggleModule = async (moduleId: string, enabled: boolean) => {
    try {
      await fetch(`/api/crm/modules/${moduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: enabled }),
      });

      setModules((prev) =>
        prev.map((m) => (m.id === moduleId ? { ...m, is_enabled: enabled } : m))
      );
    } catch (error) {
      console.error('Failed to update module:', error);
    }
  };

  const handleCreateModule = async () => {
    if (!newModuleName.trim() || !newModuleKey.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/crm/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: profile.organization_id,
          name: newModuleName,
          key: newModuleKey.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name_plural: newModuleName + 's',
        }),
      });

      if (response.ok) {
        const module = await response.json();
        setModules((prev) => [...prev, module]);
        setShowCreateDialog(false);
        setNewModuleName('');
        setNewModuleKey('');
      }
    } catch (error) {
      console.error('Failed to create module:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/settings"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Settings
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy-800">Modules</h1>
            <p className="text-muted-foreground">
              Manage CRM modules and their visibility
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-brand-teal-600 hover:bg-brand-teal-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Module
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Module</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Module Name</Label>
                  <Input
                    placeholder="e.g., Products"
                    value={newModuleName}
                    onChange={(e) => {
                      setNewModuleName(e.target.value);
                      setNewModuleKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Module Key</Label>
                  <Input
                    placeholder="e.g., products"
                    value={newModuleKey}
                    onChange={(e) => setNewModuleKey(e.target.value)}
                    className="mt-1 font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used in URLs and API. Lowercase letters and underscores only.
                  </p>
                </div>
                <Button
                  onClick={handleCreateModule}
                  disabled={!newModuleName.trim() || !newModuleKey.trim() || isCreating}
                  className="w-full"
                >
                  Create Module
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Modules List */}
      <div className="space-y-4">
        {modules.map((module) => {
          const Icon = iconMap[module.icon] || FileText;
          return (
            <Card key={module.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="cursor-move text-muted-foreground">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-brand-teal-100 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-brand-teal-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{module.name}</h3>
                      {module.is_system && (
                        <Badge variant="secondary" className="text-xs">
                          System
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {module.description || `Manage ${module.name_plural?.toLowerCase() || module.name.toLowerCase() + 's'}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`enabled-${module.id}`} className="text-sm">
                        Enabled
                      </Label>
                      <Switch
                        id={`enabled-${module.id}`}
                        checked={module.is_enabled}
                        onCheckedChange={(checked) => handleToggleModule(module.id, checked)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/settings/fields?module=${module.id}`)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
