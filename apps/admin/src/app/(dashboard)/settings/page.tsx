'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Switch,
} from '@crm-eco/ui';
import { Save, Palette, Bell, Shield, Zap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AdminSettings {
  id?: string;
  organization_id?: string;
  // Branding
  default_primary_color: string;
  default_secondary_color: string;
  default_logo_url: string;
  company_name: string;
  // System toggles
  enrollment_auto_approve: boolean;
  require_payment_before_activation: boolean;
  send_welcome_emails: boolean;
  send_renewal_reminders: boolean;
  // Rate settings
  current_rate_version: string;
  rate_effective_date: string;
  // Notification settings
  admin_notification_email: string;
  billing_notification_email: string;
  // Feature flags
  enable_self_enrollment: boolean;
  enable_agent_enrollment: boolean;
  enable_dependent_management: boolean;
}

const defaultSettings: AdminSettings = {
  default_primary_color: '#1e40af',
  default_secondary_color: '#3b82f6',
  default_logo_url: '',
  company_name: '',
  enrollment_auto_approve: false,
  require_payment_before_activation: true,
  send_welcome_emails: true,
  send_renewal_reminders: true,
  current_rate_version: '2026',
  rate_effective_date: '',
  admin_notification_email: '',
  billing_notification_email: '',
  enable_self_enrollment: true,
  enable_agent_enrollment: true,
  enable_dependent_management: true,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<AdminSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('user_id', user.id)
          .single() as { data: { organization_id: string } | null };

        if (!profile) return;

        const { data: existingSettings } = await supabase
          .from('admin_settings')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .single() as { data: AdminSettings | null };

        if (existingSettings) {
          setSettings({
            ...defaultSettings,
            ...existingSettings,
            rate_effective_date: existingSettings.rate_effective_date || '',
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [supabase]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to save settings.');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single() as { data: { organization_id: string } | null };

      if (!profile) {
        toast.error('Could not find your organization profile.');
        return;
      }

      const settingsToSave = {
        organization_id: profile.organization_id,
        default_primary_color: settings.default_primary_color,
        default_secondary_color: settings.default_secondary_color,
        default_logo_url: settings.default_logo_url || null,
        company_name: settings.company_name || null,
        enrollment_auto_approve: settings.enrollment_auto_approve,
        require_payment_before_activation: settings.require_payment_before_activation,
        send_welcome_emails: settings.send_welcome_emails,
        send_renewal_reminders: settings.send_renewal_reminders,
        current_rate_version: settings.current_rate_version,
        rate_effective_date: settings.rate_effective_date || null,
        admin_notification_email: settings.admin_notification_email || null,
        billing_notification_email: settings.billing_notification_email || null,
        enable_self_enrollment: settings.enable_self_enrollment,
        enable_agent_enrollment: settings.enable_agent_enrollment,
        enable_dependent_management: settings.enable_dependent_management,
      };

      // Type assertion needed because admin_settings is a new table not yet in generated types
      const { error } = await (supabase
        .from('admin_settings') as ReturnType<typeof supabase.from>)
        .upsert(settingsToSave as never, { onConflict: 'organization_id' });

      if (error) throw error;

      toast.success('Settings saved successfully!');
    } catch (error: unknown) {
      console.error('Error saving settings:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to save settings: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Configure your organization&apos;s admin portal settings.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Branding Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Branding Defaults
          </CardTitle>
          <CardDescription>
            Default branding settings for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={settings.company_name}
                onChange={(e) => updateSetting('company_name', e.target.value)}
                placeholder="Your Company Name"
              />
            </div>
            <div>
              <Label htmlFor="default_logo_url">Logo URL</Label>
              <Input
                id="default_logo_url"
                value={settings.default_logo_url}
                onChange={(e) => updateSetting('default_logo_url', e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
            <div>
              <Label htmlFor="default_primary_color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="default_primary_color"
                  type="color"
                  value={settings.default_primary_color}
                  onChange={(e) => updateSetting('default_primary_color', e.target.value)}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={settings.default_primary_color}
                  onChange={(e) => updateSetting('default_primary_color', e.target.value)}
                  placeholder="#1e40af"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="default_secondary_color">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="default_secondary_color"
                  type="color"
                  value={settings.default_secondary_color}
                  onChange={(e) => updateSetting('default_secondary_color', e.target.value)}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={settings.default_secondary_color}
                  onChange={(e) => updateSetting('default_secondary_color', e.target.value)}
                  placeholder="#3b82f6"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enrollment Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Enrollment Settings
          </CardTitle>
          <CardDescription>
            Configure how enrollments are processed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enrollment_auto_approve">Auto-Approve Enrollments</Label>
              <p className="text-sm text-muted-foreground">
                Automatically approve new enrollments without manual review.
              </p>
            </div>
            <Switch
              id="enrollment_auto_approve"
              checked={settings.enrollment_auto_approve}
              onCheckedChange={(checked) => updateSetting('enrollment_auto_approve', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="require_payment">Require Payment Before Activation</Label>
              <p className="text-sm text-muted-foreground">
                Members must complete payment before enrollment is activated.
              </p>
            </div>
            <Switch
              id="require_payment"
              checked={settings.require_payment_before_activation}
              onCheckedChange={(checked) => updateSetting('require_payment_before_activation', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure email notifications and alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="admin_notification_email">Admin Notification Email</Label>
              <Input
                id="admin_notification_email"
                type="email"
                value={settings.admin_notification_email}
                onChange={(e) => updateSetting('admin_notification_email', e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <Label htmlFor="billing_notification_email">Billing Notification Email</Label>
              <Input
                id="billing_notification_email"
                type="email"
                value={settings.billing_notification_email}
                onChange={(e) => updateSetting('billing_notification_email', e.target.value)}
                placeholder="billing@example.com"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="send_welcome_emails">Send Welcome Emails</Label>
              <p className="text-sm text-muted-foreground">
                Send welcome emails to new members upon enrollment approval.
              </p>
            </div>
            <Switch
              id="send_welcome_emails"
              checked={settings.send_welcome_emails}
              onCheckedChange={(checked) => updateSetting('send_welcome_emails', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="send_renewal_reminders">Send Renewal Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Send automatic renewal reminder emails to members.
              </p>
            </div>
            <Switch
              id="send_renewal_reminders"
              checked={settings.send_renewal_reminders}
              onCheckedChange={(checked) => updateSetting('send_renewal_reminders', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Rate Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Rate Configuration
          </CardTitle>
          <CardDescription>
            Manage pricing rate versions and effective dates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="current_rate_version">Current Rate Version</Label>
              <Input
                id="current_rate_version"
                value={settings.current_rate_version}
                onChange={(e) => updateSetting('current_rate_version', e.target.value)}
                placeholder="2026"
              />
            </div>
            <div>
              <Label htmlFor="rate_effective_date">Rate Effective Date</Label>
              <Input
                id="rate_effective_date"
                type="date"
                value={settings.rate_effective_date}
                onChange={(e) => updateSetting('rate_effective_date', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
          <CardDescription>
            Enable or disable specific features in your portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable_self_enrollment">Self-Service Enrollment</Label>
              <p className="text-sm text-muted-foreground">
                Allow members to enroll themselves via public enrollment links.
              </p>
            </div>
            <Switch
              id="enable_self_enrollment"
              checked={settings.enable_self_enrollment}
              onCheckedChange={(checked) => updateSetting('enable_self_enrollment', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable_agent_enrollment">Agent Enrollment</Label>
              <p className="text-sm text-muted-foreground">
                Allow agents to enroll members on their behalf.
              </p>
            </div>
            <Switch
              id="enable_agent_enrollment"
              checked={settings.enable_agent_enrollment}
              onCheckedChange={(checked) => updateSetting('enable_agent_enrollment', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable_dependent_management">Dependent Management</Label>
              <p className="text-sm text-muted-foreground">
                Allow members to add and manage dependents.
              </p>
            </div>
            <Switch
              id="enable_dependent_management"
              checked={settings.enable_dependent_management}
              onCheckedChange={(checked) => updateSetting('enable_dependent_management', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
