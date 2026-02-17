'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@crm-eco/ui';
import {
  Save,
  Loader2,
  User,
  Building2,
  Shield,
  Globe,
  Clock,
  Mail,
  Phone,
  Camera,
  CalendarDays,
  KeyRound,
  Palette,
  Monitor,
  Moon,
  Sun,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProfileData {
  id: string;
  user_id: string;
  organization_id: string;
  full_name: string;
  display_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  crm_role: string | null;
  advisor_role: string | null;
  advisor_id: string | null;
  is_active: boolean | null;
  is_super_admin: boolean | null;
  time_zone: string | null;
  ui_theme: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown> | null;
  created_at: string | null;
}

interface AdminSettingsData {
  company_name: string | null;
  default_logo_url: string | null;
  admin_notification_email: string | null;
  billing_notification_email: string | null;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'UTC', label: 'UTC' },
];

function getRoleLabel(role: string) {
  const map: Record<string, string> = {
    owner: 'Owner',
    admin: 'Administrator',
    staff: 'Staff',
    agent: 'Agent',
    member: 'Member',
  };
  return map[role] || role;
}

function getRoleBadgeVariant(role: string) {
  const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    owner: 'default',
    admin: 'default',
    staff: 'secondary',
    agent: 'outline',
  };
  return map[role] || 'outline';
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [adminSettings, setAdminSettings] = useState<AdminSettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Editable fields
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const [uiTheme, setUiTheme] = useState('system');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const supabase = createClient();

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profileData) {
        console.error('Error fetching profile:', profileError);
        toast.error('Failed to load profile data.');
        return;
      }

      const p = profileData as unknown as ProfileData;
      setProfile(p);
      setFullName(p.full_name || '');
      setDisplayName(p.display_name || '');
      setPhone(p.phone || '');
      setTimeZone(p.time_zone || 'America/New_York');
      setUiTheme(p.ui_theme || 'system');

      // Fetch organization
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', p.organization_id)
        .single();

      if (orgData) {
        setOrganization(orgData as unknown as OrganizationData);
      }

      // Fetch admin settings for company info
      const { data: settingsData } = await (
        supabase.from('admin_settings') as ReturnType<typeof supabase.from>
      )
        .select('company_name, default_logo_url, admin_notification_email, billing_notification_email')
        .eq('organization_id', p.organization_id)
        .single();

      if (settingsData) {
        setAdminSettings(settingsData as unknown as AdminSettingsData);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('An error occurred while loading your profile.');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Track changes
  useEffect(() => {
    if (!profile) return;
    const changed =
      fullName !== (profile.full_name || '') ||
      displayName !== (profile.display_name || '') ||
      phone !== (profile.phone || '') ||
      timeZone !== (profile.time_zone || 'America/New_York') ||
      uiTheme !== (profile.ui_theme || 'system');
    setHasChanges(changed);
  }, [fullName, displayName, phone, timeZone, uiTheme, profile]);

  const handleSaveProfile = async () => {
    if (!profile) return;

    if (!fullName.trim()) {
      toast.error('Full name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          display_name: displayName.trim() || null,
          phone: phone.trim() || null,
          time_zone: timeZone || null,
          ui_theme: uiTheme || null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', profile.id);

      if (error) throw error;

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              full_name: fullName.trim(),
              display_name: displayName.trim() || null,
              phone: phone.trim() || null,
              time_zone: timeZone || null,
              ui_theme: uiTheme || null,
              updated_at: new Date().toISOString(),
            }
          : null
      );

      setHasChanges(false);
      toast.success('Profile updated successfully.');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully.');
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">Unable to load profile data.</p>
          <Button variant="outline" onClick={loadProfile}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account settings and preferences
          </p>
        </div>
        <Button onClick={handleSaveProfile} disabled={isSaving || !hasChanges}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Profile Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="relative group">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                {profile.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                ) : null}
                <AvatarFallback className="text-2xl font-semibold bg-primary/10 text-primary">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <button
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => toast.info('Avatar upload coming soon.')}
              >
                <Camera className="h-6 w-6 text-white" />
              </button>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold truncate">{profile.full_name}</h2>
                <Badge variant={getRoleBadgeVariant(profile.role)}>
                  {getRoleLabel(profile.role)}
                </Badge>
                {profile.is_active !== false ? (
                  <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 dark:text-green-400 dark:border-green-800 dark:bg-green-950">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Inactive
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1">{profile.email}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {organization && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {adminSettings?.company_name || organization.name}
                  </span>
                )}
                {profile.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {profile.phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Joined {formatDate(profile.created_at)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Content */}
      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="w-full justify-start h-auto flex-wrap gap-1 bg-transparent p-0 border-b rounded-none">
          <TabsTrigger
            value="personal"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3"
          >
            <User className="h-4 w-4 mr-2" />
            Personal Info
          </TabsTrigger>
          <TabsTrigger
            value="business"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3"
          >
            <Building2 className="h-4 w-4 mr-2" />
            Business Details
          </TabsTrigger>
          <TabsTrigger
            value="preferences"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3"
          >
            <Palette className="h-4 w-4 mr-2" />
            Preferences
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3"
          >
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Personal Information Tab */}
        <TabsContent value="personal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Your basic personal details. This information may be visible to other administrators.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your legal name as it appears on official records.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How you'd like to be addressed"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. Shown in the UI instead of your full name.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      value={profile.email}
                      disabled
                      className="pl-9 bg-muted/50"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Email is tied to your authentication account and cannot be changed here.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Account Details
              </CardTitle>
              <CardDescription>
                Read-only information about your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Account ID</p>
                  <p className="text-sm font-mono">{profile.id.slice(0, 8)}...{profile.id.slice(-4)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Account Created</p>
                  <p className="text-sm">{formatDateTime(profile.created_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                  <p className="text-sm">{formatDateTime(profile.updated_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <div className="flex items-center gap-1.5">
                    {profile.is_active !== false ? (
                      <>
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-sm">Active</span>
                      </>
                    ) : (
                      <>
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-sm">Inactive</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Role</p>
                  <p className="text-sm">{getRoleLabel(profile.role)}</p>
                </div>
                {profile.is_super_admin && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Super Admin</p>
                    <Badge variant="default" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      Yes
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Details Tab */}
        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization
              </CardTitle>
              <CardDescription>
                Your organization membership and business information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Organization Name</p>
                  <p className="text-sm font-semibold">{organization?.name || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Company Name</p>
                  <p className="text-sm">{adminSettings?.company_name || 'Not configured'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Organization Slug</p>
                  <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded inline-block">
                    {organization?.slug || 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Organization ID</p>
                  <p className="text-sm font-mono">
                    {profile.organization_id.slice(0, 8)}...{profile.organization_id.slice(-4)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Organization Created</p>
                  <p className="text-sm">{formatDate(organization?.created_at || null)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Roles &amp; Permissions
              </CardTitle>
              <CardDescription>
                Your assigned roles and access levels within the system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">System Role</p>
                  <Badge variant={getRoleBadgeVariant(profile.role)} className="text-sm">
                    {getRoleLabel(profile.role)}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your primary access level in the admin portal.
                  </p>
                </div>

                {profile.crm_role && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">CRM Role</p>
                    <Badge variant="outline" className="text-sm">
                      {profile.crm_role}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your role within the CRM system.
                    </p>
                  </div>
                )}

                {profile.advisor_role && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Advisor Role</p>
                    <Badge variant="outline" className="text-sm">
                      {profile.advisor_role}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your advisor classification.
                    </p>
                  </div>
                )}

                {profile.advisor_id && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Advisor ID</p>
                    <p className="text-sm font-mono">
                      {profile.advisor_id.slice(0, 8)}...{profile.advisor_id.slice(-4)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Linked advisor record reference.
                    </p>
                  </div>
                )}
              </div>

              <Separator className="my-6" />

              <div>
                <h4 className="text-sm font-medium mb-3">Access Summary</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      label: 'Admin Portal',
                      granted: ['owner', 'admin', 'staff'].includes(profile.role),
                    },
                    {
                      label: 'Member Management',
                      granted: ['owner', 'admin', 'staff'].includes(profile.role),
                    },
                    {
                      label: 'Billing & Payments',
                      granted: ['owner', 'admin'].includes(profile.role),
                    },
                    {
                      label: 'Organization Settings',
                      granted: ['owner', 'admin'].includes(profile.role),
                    },
                    {
                      label: 'User Management',
                      granted: profile.role === 'owner',
                    },
                    {
                      label: 'Audit Logs',
                      granted: ['owner', 'admin'].includes(profile.role),
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-2 text-sm px-3 py-2 rounded-md bg-muted/30"
                    >
                      {item.granted ? (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className={item.granted ? '' : 'text-muted-foreground'}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Business Contact
              </CardTitle>
              <CardDescription>
                Organization contact emails configured for notifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Admin Notification Email</p>
                  <p className="text-sm">
                    {adminSettings?.admin_notification_email || (
                      <span className="text-muted-foreground italic">Not configured</span>
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Billing Notification Email</p>
                  <p className="text-sm">
                    {adminSettings?.billing_notification_email || (
                      <span className="text-muted-foreground italic">Not configured</span>
                    )}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                These emails can be changed in{' '}
                <a href="/settings" className="text-primary underline underline-offset-2 hover:text-primary/80">
                  Organization Settings
                </a>
                .
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize how the admin portal looks and feels for you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Theme</Label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'light', label: 'Light', icon: Sun },
                    { value: 'dark', label: 'Dark', icon: Moon },
                    { value: 'system', label: 'System', icon: Monitor },
                  ].map((theme) => {
                    const Icon = theme.icon;
                    return (
                      <button
                        key={theme.value}
                        onClick={() => setUiTheme(theme.value)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                          uiTheme === theme.value
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/25'
                        }`}
                      >
                        <Icon
                          className={`h-6 w-6 ${
                            uiTheme === theme.value ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        />
                        <span
                          className={`text-sm font-medium ${
                            uiTheme === theme.value ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        >
                          {theme.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Regional Settings
              </CardTitle>
              <CardDescription>
                Configure your timezone and locale preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={timeZone} onValueChange={setTimeZone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Used for displaying dates and scheduling.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Current Time</Label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/50 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {new Date().toLocaleTimeString('en-US', {
                        timeZone: timeZone || 'America/New_York',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZoneName: 'short',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure. You&apos;ll need to sign in again after
                changing your password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum 8 characters. Use a mix of letters, numbers, and symbols.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !newPassword || !confirmPassword}
                  variant="default"
                >
                  {isChangingPassword ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Account Security
              </CardTitle>
              <CardDescription>
                Security overview and account protection settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Email Verified</p>
                      <p className="text-xs text-muted-foreground">{profile.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-green-700 dark:text-green-400">
                    Verified
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Two-Factor Authentication</p>
                      <p className="text-xs text-muted-foreground">
                        Add an extra layer of security to your account.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-amber-700 dark:text-amber-400">
                    Not Enabled
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Last Profile Update</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(profile.updated_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
