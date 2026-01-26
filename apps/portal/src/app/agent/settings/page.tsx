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
  Smartphone,
  Copy,
  Check,
  Loader2,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
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

  // 2FA State
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    checkMfaStatus();
    setLoading(false);
  }, []);

  const checkMfaStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const totpFactor = data?.totp?.find(f => f.status === 'verified');
      setMfaEnabled(!!totpFactor);
    } catch (error) {
      console.error('Error checking MFA status:', error);
    }
  };

  const handleEnableMfa = async () => {
    setMfaLoading(true);
    try {
      // Enroll a new TOTP factor
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });

      if (error) throw error;

      if (data.totp?.qr_code && data.totp?.secret) {
        // Supabase provides the QR code as a data URL directly
        setMfaQrCode(data.totp.qr_code);
        setMfaSecret(data.totp.secret);
        setMfaFactorId(data.id);
        setShowMfaSetup(true);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to start 2FA setup';
      toast.error(message);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaFactorId || mfaVerifyCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setMfaLoading(true);
    try {
      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });

      if (challengeError) throw challengeError;

      // Verify the challenge
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaVerifyCode,
      });

      if (verifyError) throw verifyError;

      toast.success('Two-factor authentication enabled!');
      setMfaEnabled(true);
      setShowMfaSetup(false);
      resetMfaState();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid verification code';
      toast.error(message);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
      return;
    }

    setMfaLoading(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const totpFactor = data?.totp?.find(f => f.status === 'verified');

      if (totpFactor) {
        const { error } = await supabase.auth.mfa.unenroll({
          factorId: totpFactor.id,
        });

        if (error) throw error;

        toast.success('Two-factor authentication disabled');
        setMfaEnabled(false);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to disable 2FA';
      toast.error(message);
    } finally {
      setMfaLoading(false);
    }
  };

  const resetMfaState = () => {
    setMfaQrCode(null);
    setMfaSecret(null);
    setMfaFactorId(null);
    setMfaVerifyCode('');
    setSecretCopied(false);
  };

  const copySecret = () => {
    if (mfaSecret) {
      navigator.clipboard.writeText(mfaSecret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    }
  };

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
          <div className={`p-4 rounded-lg ${mfaEnabled ? 'bg-green-50 border border-green-200' : 'bg-slate-50'}`}>
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Two-Factor Authentication
                </h4>
                <p className="text-sm text-slate-500 mb-4">
                  {mfaEnabled
                    ? 'Your account is protected with two-factor authentication.'
                    : 'Add an extra layer of security to your account using an authenticator app.'}
                </p>
              </div>
              {mfaEnabled && (
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Enabled
                </span>
              )}
            </div>
            {mfaEnabled ? (
              <Button
                variant="outline"
                onClick={handleDisableMfa}
                disabled={mfaLoading}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Disable 2FA
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleEnableMfa}
                disabled={mfaLoading}
              >
                {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enable 2FA
              </Button>
            )}
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

      {/* 2FA Setup Dialog */}
      <Dialog open={showMfaSetup} onOpenChange={(open) => { if (!open) { resetMfaState(); setShowMfaSetup(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Set Up Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* QR Code */}
            {mfaQrCode && (
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg border">
                  <img src={mfaQrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              </div>
            )}

            {/* Manual Entry */}
            {mfaSecret && (
              <div className="space-y-2">
                <Label className="text-sm text-slate-500">
                  Or enter this code manually:
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-slate-100 rounded font-mono text-sm break-all">
                    {mfaSecret}
                  </code>
                  <Button variant="outline" size="icon" onClick={copySecret}>
                    {secretCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Verification Code */}
            <div className="space-y-2">
              <Label htmlFor="verify-code">Enter the 6-digit code from your app:</Label>
              <Input
                id="verify-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={mfaVerifyCode}
                onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetMfaState(); setShowMfaSetup(false); }}>
              Cancel
            </Button>
            <Button
              onClick={handleVerifyMfa}
              disabled={mfaLoading || mfaVerifyCode.length !== 6}
            >
              {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Verify & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
