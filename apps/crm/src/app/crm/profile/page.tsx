'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
    ArrowLeft,
    User,
    Mail,
    Phone,
    Building,
    Shield,
    Save,
    Loader2,
    Camera,
    Key,
    Bell,
    Palette,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@crm-eco/ui/components/avatar';

interface ProfileData {
    id: string;
    user_id: string;
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    crm_role: string | null;
    organization_id: string;
    ui_theme: string | null;
}

export default function ProfilePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [form, setForm] = useState({
        full_name: '',
        phone: '',
        ui_theme: 'light',
    });

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        async function loadProfile() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push('/crm-login');
                    return;
                }

                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error) throw error;

                setProfile(data);
                setForm({
                    full_name: data.full_name || '',
                    phone: data.phone || '',
                    ui_theme: data.ui_theme || 'light',
                });
            } catch (error) {
                console.error('Failed to load profile:', error);
                toast.error('Failed to load profile');
            } finally {
                setLoading(false);
            }
        }

        loadProfile();
    }, [supabase, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: form.full_name,
                    phone: form.phone || null,
                    ui_theme: form.ui_theme,
                })
                .eq('id', profile.id);

            if (error) throw error;

            toast.success('Profile updated successfully');
            router.refresh();
        } catch (error) {
            console.error('Failed to update profile:', error);
            toast.error('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getRoleLabel = (role: string | null) => {
        switch (role) {
            case 'crm_admin': return 'Administrator';
            case 'crm_manager': return 'Manager';
            case 'crm_agent': return 'Sales Agent';
            case 'crm_viewer': return 'Viewer';
            default: return 'User';
        }
    };

    const getRoleBadgeStyle = (role: string | null) => {
        switch (role) {
            case 'crm_admin':
                return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400';
            case 'crm_manager':
                return 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400';
            case 'crm_agent':
                return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400';
            default:
                return 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-400';
        }
    };

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto animate-pulse space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                    <div className="space-y-2">
                        <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                    </div>
                </div>
                <div className="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="max-w-3xl mx-auto text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">Profile not found</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/crm"
                    className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Profile</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        View and update your profile information
                    </p>
                </div>
            </div>

            {/* Profile Card */}
            <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                {/* Avatar Section */}
                <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-cyan-500/10 px-6 py-8 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <Avatar className="w-24 h-24 border-4 border-white dark:border-slate-800 shadow-lg">
                                <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name} />
                                <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-500 text-white text-2xl font-bold">
                                    {getInitials(profile.full_name)}
                                </AvatarFallback>
                            </Avatar>
                            <button className="absolute bottom-0 right-0 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                <Camera className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                            </button>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{profile.full_name}</h2>
                            <p className="text-slate-500 dark:text-slate-400">{profile.email}</p>
                            <div className="mt-2">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeStyle(profile.crm_role)}`}>
                                    <Shield className="w-3.5 h-3.5" />
                                    {getRoleLabel(profile.crm_role)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Personal Information */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Personal Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    value={form.full_name}
                                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="email"
                                        value={profile.email}
                                        disabled
                                        className="w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Phone Number
                                </label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        placeholder="+1 (555) 000-0000"
                                        className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preferences */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Palette className="w-4 h-4" />
                            Preferences
                        </h3>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Theme
                            </label>
                            <select
                                value={form.ui_theme}
                                onChange={(e) => setForm({ ...form, ui_theme: e.target.value })}
                                className="w-full md:w-64 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            >
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                                <option value="system">System</option>
                            </select>
                        </div>
                    </div>

                    {/* Security Section */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Key className="w-4 h-4" />
                            Security
                        </h3>
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">Password</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Last changed: Never</p>
                            </div>
                            <button
                                type="button"
                                className="px-4 py-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg transition-colors"
                            >
                                Change Password
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <Link
                            href="/crm"
                            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
