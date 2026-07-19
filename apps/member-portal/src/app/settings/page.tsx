'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Bell,
  Lock,
  Envelope,
  DeviceMobile,
  Globe,
  CircleNotch,
  CheckCircle,
  Shield,
} from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Switch } from '@crm-eco/ui/components/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import {
  getMemberSettings,
  saveNotificationPreferences,
  saveLocalePreferences,
  requestPrivacyAction,
} from './actions';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(true);
  const [billingReminders, setBillingReminders] = useState(true);
  const [needUpdates, setNeedUpdates] = useState(true);

  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('America/New_York');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingLocale, setSavingLocale] = useState(false);
  const [privacyPending, setPrivacyPending] = useState<null | 'export' | 'deletion'>(null);

  const supabase = createClient();

  useEffect(() => {
    let active = true;
    getMemberSettings()
      .then((s) => {
        if (!active) return;
        setEmailNotifications(s.emailNotifications);
        setSmsNotifications(s.smsNotifications);
        setBillingReminders(s.billingReminders);
        setNeedUpdates(s.needUpdates);
        setMarketingEmails(s.marketingEmails);
        setLanguage(s.language);
        setTimezone(s.timezone);
      })
      .catch(() => {
        if (active) toast.error('Could not load your settings.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    const result = await saveNotificationPreferences({
      emailNotifications,
      smsNotifications,
      billingReminders,
      needUpdates,
      marketingEmails,
    });
    if (result.success) {
      toast.success('Notification preferences saved!');
    } else {
      toast.error(result.error ?? 'Failed to save preferences');
    }
    setSavingNotifications(false);
  };

  const handleSaveLocale = async () => {
    setSavingLocale(true);
    const result = await saveLocalePreferences({ language, timezone });
    if (result.success) {
      toast.success('Language & region saved!');
    } else {
      toast.error(result.error ?? 'Failed to save language & region');
    }
    setSavingLocale(false);
  };

  const handlePrivacyAction = async (kind: 'export' | 'deletion') => {
    const confirmText =
      kind === 'deletion'
        ? 'Request permanent deletion of your account and data? Our team will contact you to confirm before anything is removed.'
        : 'Request a copy of all your personal data? Our team will prepare it and follow up by email.';
    if (
      !(await confirmDialog({
        title: 'Confirm your request',
        description: confirmText,
        confirmLabel: 'Submit request',
        destructive: true,
      }))
    )
      return;

    setPrivacyPending(kind);
    const result = await requestPrivacyAction(kind);
    if (result.success) {
      toast.success(
        kind === 'deletion'
          ? 'Account deletion request submitted. Our team will be in touch.'
          : 'Data download request submitted. We will email you when it is ready.',
      );
    } else {
      toast.error(result.error ?? 'Failed to submit request');
    }
    setPrivacyPending(null);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSavingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast.error(`Failed to update password: ${error.message}`);
    } else {
      toast.success('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    }
    
    setSavingPassword(false);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <CircleNotch weight="light" className="h-8 w-8 animate-spin text-[var(--mp-teal)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account preferences"
      />

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell weight="light" className="h-5 w-5" aria-hidden />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose how you want to receive updates and alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Envelope weight="light" className="h-5 w-5 text-slate-500" aria-hidden />
                <div>
                  <p className="font-medium text-slate-900">Email Notifications</p>
                  <p className="text-sm text-slate-500">Receive updates via email</p>
                </div>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DeviceMobile weight="light" className="h-5 w-5 text-slate-500" aria-hidden />
                <div>
                  <p className="font-medium text-slate-900">SMS Notifications</p>
                  <p className="text-sm text-slate-500">Receive text message alerts</p>
                </div>
              </div>
              <Switch
                checked={smsNotifications}
                onCheckedChange={setSmsNotifications}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="font-medium text-slate-900 mb-4">Email Notification Types</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Billing Reminders</p>
                  <p className="text-xs text-slate-500">Payment due dates and receipts</p>
                </div>
                <Switch
                  checked={billingReminders}
                  onCheckedChange={setBillingReminders}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Need Status Updates</p>
                  <p className="text-xs text-slate-500">Updates on your submitted needs</p>
                </div>
                <Switch
                  checked={needUpdates}
                  onCheckedChange={setNeedUpdates}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Marketing & Tips</p>
                  <p className="text-xs text-slate-500">Health tips and membership updates</p>
                </div>
                <Switch
                  checked={marketingEmails}
                  onCheckedChange={setMarketingEmails}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSaveNotifications} disabled={savingNotifications}>
              {savingNotifications ? (
                <CircleNotch weight="light" className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CheckCircle weight="light" className="mr-2 h-4 w-4" aria-hidden />
              )}
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock weight="light" className="h-5 w-5" aria-hidden />
            Security
          </CardTitle>
          <CardDescription>
            Update your password and security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <p className="text-xs text-slate-500">Must be at least 8 characters</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={savingPassword || !newPassword}>
                {savingPassword ? (
                  <CircleNotch weight="light" className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Shield weight="light" className="mr-2 h-4 w-4" aria-hidden />
                )}
                Update Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Language & Region */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe weight="light" className="h-5 w-5" aria-hidden />
            Language & Region
          </CardTitle>
          <CardDescription>
            Set your preferred language and regional settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveLocale} disabled={savingLocale}>
              {savingLocale ? (
                <CircleNotch weight="light" className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CheckCircle weight="light" className="mr-2 h-4 w-4" aria-hidden />
              )}
              Save Language &amp; Region
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data & Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield weight="light" className="h-5 w-5" aria-hidden />
            Data & Privacy
          </CardTitle>
          <CardDescription>
            Manage your data and privacy settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-lg border">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-slate-900">Download My Data</p>
                <p className="text-sm text-slate-500 mt-1">
                  Get a copy of all your personal data stored in our system
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePrivacyAction('export')}
                disabled={privacyPending !== null}
              >
                {privacyPending === 'export' ? (
                  <CircleNotch weight="light" className="h-4 w-4 animate-spin" />
                ) : (
                  'Request Download'
                )}
              </Button>
            </div>
          </div>

          <div className="p-4 bg-red-50 rounded-lg border border-red-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-red-900">Delete Account</p>
                <p className="text-sm text-red-700 mt-1">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handlePrivacyAction('deletion')}
                disabled={privacyPending !== null}
              >
                {privacyPending === 'deletion' ? (
                  <CircleNotch weight="light" className="h-4 w-4 animate-spin" />
                ) : (
                  'Delete Account'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
