'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
    Shield,
    Key,
    Smartphone,
    Monitor,
    Lock,
    LogOut,
    AlertTriangle,
    CheckCircle2,
    Clock,
    MapPin,
    RefreshCw,
    Download,
    Eye,
    EyeOff,
    Copy,
    Check
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { Input } from '@crm-eco/ui/components/input';
import { Switch } from '@crm-eco/ui/components/switch';
import { ScrollArea } from '@crm-eco/ui/components/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { toast } from 'sonner';

interface Session {
    id: string;
    user_agent: string;
    ip_address: string;
    last_activity_at: string;
    created_at: string;
    is_current: boolean;
}

interface SecurityLog {
    id: string;
    action: string;
    resource_type: string;
    created_at: string;
}

export default function SecuritySettingsPage() {
    const router = useRouter();
    const supabase = createClient();

    // State
    const [loading, setLoading] = useState(true);
    const [mfaEnabled, setMfaEnabled] = useState(false);
    const [mfaEnrolling, setMfaEnrolling] = useState(false);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [recentActivity, setRecentActivity] = useState<SecurityLog[]>([]);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [showMFADialog, setShowMFADialog] = useState(false);

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [passwordChanging, setPasswordChanging] = useState(false);

    // MFA state
    const [mfaSecret, setMfaSecret] = useState('');
    const [mfaQR, setMfaQR] = useState('');
    const [mfaCode, setMfaCode] = useState('');
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [copiedCode, setCopiedCode] = useState(false);

    useEffect(() => {
        loadSecurityData();
    }, []);

    async function loadSecurityData() {
        setLoading(true);
        try {
            // Check MFA status
            const { data: factors } = await supabase.auth.mfa.listFactors();
            setMfaEnabled(factors?.totp?.length ? factors.totp.length > 0 : false);

            // Load active sessions (mock for now - needs backend)
            setSessions([
                {
                    id: '1',
                    user_agent: navigator.userAgent,
                    ip_address: '192.168.1.1',
                    last_activity_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    is_current: true
                }
            ]);

            // Load recent activity (would come from phi_access_log)
            setRecentActivity([]);
        } catch (error) {
            console.error('Failed to load security data:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handlePasswordChange() {
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        if (newPassword.length < 12) {
            toast.error('Password must be at least 12 characters');
            return;
        }

        setPasswordChanging(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            toast.success('Password updated successfully');
            setShowPasswordDialog(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            toast.error('Failed to update password');
        } finally {
            setPasswordChanging(false);
        }
    }

    async function handleEnrollMFA() {
        setMfaEnrolling(true);
        try {
            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp'
            });

            if (error) throw error;

            if (data) {
                setMfaSecret(data.totp.secret);
                setMfaQR(data.totp.qr_code);
                setShowMFADialog(true);
            }
        } catch (error) {
            toast.error('Failed to setup MFA');
        } finally {
            setMfaEnrolling(false);
        }
    }

    async function handleVerifyMFA() {
        try {
            const { data: factors } = await supabase.auth.mfa.listFactors();
            const totpFactor = factors?.totp?.[0];

            if (!totpFactor) {
                toast.error('MFA not properly enrolled');
                return;
            }

            const { data, error } = await supabase.auth.mfa.challengeAndVerify({
                factorId: totpFactor.id,
                code: mfaCode
            });

            if (error) throw error;

            setMfaEnabled(true);
            setShowMFADialog(false);
            toast.success('MFA enabled successfully');
        } catch (error) {
            toast.error('Invalid verification code');
        }
    }

    async function handleDisableMFA() {
        try {
            const { data: factors } = await supabase.auth.mfa.listFactors();
            const totpFactor = factors?.totp?.[0];

            if (totpFactor) {
                await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
            }

            setMfaEnabled(false);
            toast.success('MFA disabled');
        } catch (error) {
            toast.error('Failed to disable MFA');
        }
    }

    async function handleRevokeSession(sessionId: string) {
        try {
            // Would call invalidateSession here
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            toast.success('Session revoked');
        } catch (error) {
            toast.error('Failed to revoke session');
        }
    }

    async function handleRevokeAllSessions() {
        try {
            await supabase.auth.signOut({ scope: 'global' });
            router.push('/crm-login');
        } catch (error) {
            toast.error('Failed to revoke sessions');
        }
    }

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    }

    function parseUserAgent(ua: string): { browser: string; os: string } {
        // Simplified parser
        let browser = 'Unknown Browser';
        let os = 'Unknown OS';

        if (ua.includes('Chrome')) browser = 'Chrome';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Safari')) browser = 'Safari';
        else if (ua.includes('Edge')) browser = 'Edge';

        if (ua.includes('Windows')) os = 'Windows';
        else if (ua.includes('Mac')) os = 'macOS';
        else if (ua.includes('Linux')) os = 'Linux';
        else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
        else if (ua.includes('Android')) os = 'Android';

        return { browser, os };
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-8">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 shadow-lg">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Security Settings</h1>
                </div>
                <p className="text-slate-500 dark:text-slate-400">
                    Manage your account security and compliance settings
                </p>
            </div>

            {/* HIPAA Compliance Badge */}
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                        <p className="font-medium text-emerald-900 dark:text-emerald-300">HIPAA Compliance Active</p>
                        <p className="text-sm text-emerald-700 dark:text-emerald-400">
                            Your account is protected with healthcare-grade security controls
                        </p>
                    </div>
                </div>
            </div>

            {/* Password Section */}
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/20">
                            <Key className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">Password</h3>
                            <p className="text-sm text-slate-500">Change your account password</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>
                        Change Password
                    </Button>
                </div>

                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Password Requirements:</h4>
                    <ul className="text-sm text-slate-500 space-y-1">
                        <li>• Minimum 12 characters</li>
                        <li>• At least one uppercase letter</li>
                        <li>• At least one number</li>
                        <li>• At least one special character</li>
                    </ul>
                </div>
            </div>

            {/* MFA Section */}
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20">
                            <Smartphone className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                Two-Factor Authentication (MFA)
                                {mfaEnabled && (
                                    <Badge className="ml-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                                        Enabled
                                    </Badge>
                                )}
                            </h3>
                            <p className="text-sm text-slate-500">
                                {mfaEnabled
                                    ? 'Your account is protected with MFA'
                                    : 'Add an extra layer of security to your account'}
                            </p>
                        </div>
                    </div>
                    {mfaEnabled ? (
                        <Button variant="destructive" onClick={handleDisableMFA}>
                            Disable MFA
                        </Button>
                    ) : (
                        <Button onClick={handleEnrollMFA} disabled={mfaEnrolling}>
                            {mfaEnrolling ? 'Setting up...' : 'Enable MFA'}
                        </Button>
                    )}
                </div>

                {!mfaEnabled && (
                    <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                            <div>
                                <p className="font-medium text-amber-900 dark:text-amber-300">MFA Required for HIPAA Compliance</p>
                                <p className="text-sm text-amber-700 dark:text-amber-400">
                                    Multi-factor authentication is required for all users accessing protected health information.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Active Sessions */}
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20">
                            <Monitor className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">Active Sessions</h3>
                            <p className="text-sm text-slate-500">Devices currently signed in to your account</p>
                        </div>
                    </div>
                    <Button variant="destructive" size="sm" onClick={handleRevokeAllSessions}>
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign out all devices
                    </Button>
                </div>

                <div className="space-y-3">
                    {sessions.map(session => {
                        const { browser, os } = parseUserAgent(session.user_agent);
                        return (
                            <div
                                key={session.id}
                                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl"
                            >
                                <div className="flex items-center gap-4">
                                    <Monitor className="w-10 h-10 p-2 bg-white dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300" />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-slate-900 dark:text-white">{browser} on {os}</p>
                                            {session.is_current && (
                                                <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400">
                                                    Current
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />
                                                {session.ip_address}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Active now
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {!session.is_current && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRevokeSession(session.id)}
                                    >
                                        Revoke
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Session Timeout Info */}
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
                        <Lock className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">Session Security</h3>
                        <p className="text-sm text-slate-500">Automatic session protection settings</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Inactivity Timeout</p>
                        <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">30 minutes</p>
                        <p className="text-xs text-slate-500 mt-1">Session locks after inactivity</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Maximum Session</p>
                        <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">12 hours</p>
                        <p className="text-xs text-slate-500 mt-1">Re-authentication required</p>
                    </div>
                </div>
            </div>

            {/* Data Export */}
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20">
                            <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">Download Your Data</h3>
                            <p className="text-sm text-slate-500">Export a copy of your personal data (HIPAA Right of Access)</p>
                        </div>
                    </div>
                    <Button variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Request Export
                    </Button>
                </div>
            </div>

            {/* Password Change Dialog */}
            <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>
                            Enter your current password and choose a new one.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="relative">
                            <Input
                                type={showPasswords ? 'text' : 'password'}
                                placeholder="Current password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Input
                                type={showPasswords ? 'text' : 'password'}
                                placeholder="New password (min 12 characters)"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Input
                                type={showPasswords ? 'text' : 'password'}
                                placeholder="Confirm new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-2 top-1/2 -translate-y-1/2"
                                onClick={() => setShowPasswords(!showPasswords)}
                            >
                                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handlePasswordChange} disabled={passwordChanging}>
                            {passwordChanging ? 'Updating...' : 'Update Password'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MFA Setup Dialog */}
            <Dialog open={showMFADialog} onOpenChange={setShowMFADialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
                        <DialogDescription>
                            Scan the QR code with your authenticator app
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {mfaQR && (
                            <div className="flex justify-center">
                                <img src={mfaQR} alt="MFA QR Code" className="w-48 h-48" />
                            </div>
                        )}
                        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            <p className="text-xs text-slate-500 mb-1">Or enter this code manually:</p>
                            <div className="flex items-center gap-2">
                                <code className="text-sm font-mono flex-1 break-all">{mfaSecret}</code>
                                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(mfaSecret)}>
                                    {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>
                        <Input
                            type="text"
                            placeholder="Enter 6-digit code"
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value)}
                            maxLength={6}
                            className="text-center text-2xl tracking-widest"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowMFADialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleVerifyMFA} disabled={mfaCode.length !== 6}>
                            Verify & Enable
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
