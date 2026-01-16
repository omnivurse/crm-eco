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
    Avatar,
    AvatarFallback,
    AvatarImage,
    Badge,
} from '@crm-eco/ui';
import { User, Mail, Building2, Shield, Save, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Profile {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
    role: string;
    organization_id: string;
}

const roleColors: Record<string, string> = {
    owner: 'bg-purple-100 text-purple-700',
    admin: 'bg-blue-100 text-blue-700',
    advisor: 'bg-green-100 text-green-700',
    staff: 'bg-slate-100 text-slate-700',
};

export default function ProfilePage() {
    const router = useRouter();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fullName, setFullName] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        async function loadProfile() {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login');
                return;
            }

            const { data, error } = await (supabase
                .from('profiles') as any)
                .select('*')
                .eq('id', user.id)
                .single() as { data: Profile | null; error: any };

            if (error) {
                console.error('Error loading profile:', error);
                setLoading(false);
                return;
            }

            setProfile(data);
            setFullName(data?.full_name || '');
            setLoading(false);
        }

        loadProfile();
    }, [router]);

    const handleSave = async () => {
        if (!profile) return;

        setSaving(true);
        setMessage(null);

        const supabase = createClient();
        const { error } = await (supabase
            .from('profiles') as any)
            .update({ full_name: fullName })
            .eq('id', profile.id);

        if (error) {
            setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
        } else {
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setProfile({ ...profile, full_name: fullName });
        }

        setSaving(false);
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-slate-500">Unable to load profile.</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
                <p className="text-slate-600 mt-1">Manage your account settings and preferences</p>
            </div>

            <div className="space-y-6">
                {/* Profile Overview Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-slate-600" />
                            Profile Information
                        </CardTitle>
                        <CardDescription>
                            Your personal details and role information
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-start gap-6">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name} />
                                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-xl">
                                    {getInitials(profile.full_name || 'U')}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-4">
                                <div>
                                    <Label htmlFor="fullName">Full Name</Label>
                                    <Input
                                        id="fullName"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="mt-1.5"
                                        placeholder="Enter your full name"
                                    />
                                </div>
                                <div className="flex items-center gap-4 pt-2">
                                    <Button onClick={handleSave} disabled={saving}>
                                        {saving ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="mr-2 h-4 w-4" />
                                                Save Changes
                                            </>
                                        )}
                                    </Button>
                                </div>
                                {message && (
                                    <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                        {message.text}
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Account Details Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-slate-600" />
                            Account Details
                        </CardTitle>
                        <CardDescription>
                            Your account information (read-only)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                            <Mail className="h-5 w-5 text-slate-500" />
                            <div>
                                <p className="text-sm text-slate-500">Email</p>
                                <p className="font-medium text-slate-900">{profile.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                            <Shield className="h-5 w-5 text-slate-500" />
                            <div className="flex items-center gap-3">
                                <div>
                                    <p className="text-sm text-slate-500">Role</p>
                                    <p className="font-medium text-slate-900 capitalize">{profile.role}</p>
                                </div>
                                <Badge className={roleColors[profile.role] || roleColors.staff}>
                                    {profile.role}
                                </Badge>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                            <Building2 className="h-5 w-5 text-slate-500" />
                            <div>
                                <p className="text-sm text-slate-500">Organization ID</p>
                                <p className="font-medium text-slate-900 font-mono text-sm">{profile.organization_id}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
