'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { 
  Settings, 
  Bell, 
  Lock, 
  Shield,
  Mail,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Switch } from '@crm-eco/ui/components/switch';
import { toast } from 'sonner';

export default function AgentSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [newEnrollmentAlerts, setNewEnrollmentAlerts] = useState(true);
  const [commissionAlerts, setCommissionAlerts] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    setLoading(false);
  }, []);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setSaving(true);
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/signin');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Settings className="h-12 w-12 animate-pulse text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose what notifications you want to receive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Email Notifications</p>
              <p className="text-sm text-slate-500">Receive notifications via email</p>
            </div>
            <Switch 
              checked={emailNotifications} 
              onCheckedChange={setEmailNotifications}
            />
          </div>
          <hr />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">New Enrollment Alerts</p>
              <p className="text-sm text-slate-500">Get notified when someone enrolls through your link</p>
            </div>
            <Switch 
              checked={newEnrollmentAlerts} 
              onCheckedChange={setNewEnrollmentAlerts}
              disabled={!emailNotifications}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Commission Alerts</p>
              <p className="text-sm text-slate-500">Get notified about commission payouts</p>
            </div>
            <Switch 
              checked={commissionAlerts} 
              onCheckedChange={setCommissionAlerts}
              disabled={!emailNotifications}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Marketing & Updates</p>
              <p className="text-sm text-slate-500">Receive tips, product updates, and promotions</p>
            </div>
            <Switch 
              checked={marketingEmails} 
              onCheckedChange={setMarketingEmails}
              disabled={!emailNotifications}
            />
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your password to keep your account secure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new_password">New Password</Label>
            <div className="relative">
              <Input
                id="new_password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm New Password</Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
          <Button 
            onClick={handlePasswordChange} 
            disabled={saving || !newPassword || !confirmPassword}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Updating...' : 'Update Password'}
          </Button>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-900 mb-2">Two-Factor Authentication</h4>
            <p className="text-sm text-slate-500 mb-4">
              Add an extra layer of security to your account.
            </p>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </div>
          
          <hr />
          
          <div className="p-4 bg-red-50 rounded-lg border border-red-100">
            <h4 className="font-medium text-red-900 mb-2">Sign Out</h4>
            <p className="text-sm text-red-700 mb-4">
              Sign out of your account on this device.
            </p>
            <Button variant="destructive" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
