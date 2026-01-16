'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building,
  Globe,
  Palette,
  Save,
  Upload,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { toast } from 'sonner';

interface AgentProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  website_url: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  street_address: string | null;
  apartment: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  enrollment_code: string | null;
}

export default function AgentProfilePage() {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get profile first
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single() as { data: { id: string } | null };

    if (!userProfile) {
      setLoading(false);
      return;
    }

    // Get advisor using profile_id
    const { data, error } = await supabase
      .from('advisors')
      .select('*')
      .eq('profile_id', userProfile.id)
      .single();

    if (!error && data) {
      setProfile(data as AgentProfile);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    
    setSaving(true);
    
    const { error } = await (supabase as any)
      .from('advisors')
      .update({
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
        company_name: profile.company_name,
        website_url: profile.website_url,
        primary_color: profile.primary_color,
        secondary_color: profile.secondary_color,
        street_address: profile.street_address,
        apartment: profile.apartment,
        city: profile.city,
        state: profile.state,
        zip_code: profile.zip_code,
      })
      .eq('id', profile.id);

    if (error) {
      toast.error('Failed to save profile');
    } else {
      toast.success('Profile saved successfully!');
    }
    setSaving(false);
  };

  const updateField = (field: keyof AgentProfile, value: string) => {
    if (profile) {
      setProfile({ ...profile, [field]: value });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <User className="h-12 w-12 animate-pulse text-slate-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={profile.first_name}
                onChange={(e) => updateField('first_name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={profile.last_name}
                onChange={(e) => updateField('last_name', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile.email}
                disabled
                className="bg-slate-50"
              />
              <p className="text-xs text-slate-500">Email cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={profile.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Company Information
          </CardTitle>
          <CardDescription>
            This information will appear on your branded enrollment pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={profile.company_name || ''}
                onChange={(e) => updateField('company_name', e.target.value)}
                placeholder="Your Company LLC"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website_url">Website</Label>
              <Input
                id="website_url"
                value={profile.website_url || ''}
                onChange={(e) => updateField('website_url', e.target.value)}
                placeholder="https://yourwebsite.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Agent ID</Label>
            <Input value={profile.id} disabled className="bg-slate-50 font-mono" />
          </div>
          <div className="space-y-2">
            <Label>Enrollment Code</Label>
            <Input value={profile.enrollment_code || ''} disabled className="bg-slate-50 font-mono" />
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Branding
          </CardTitle>
          <CardDescription>
            Customize how your enrollment pages look.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary_color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  id="primary_color"
                  value={profile.primary_color}
                  onChange={(e) => updateField('primary_color', e.target.value)}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={profile.primary_color}
                  onChange={(e) => updateField('primary_color', e.target.value)}
                  className="flex-1 font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary_color">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  id="secondary_color"
                  value={profile.secondary_color}
                  onChange={(e) => updateField('secondary_color', e.target.value)}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={profile.secondary_color}
                  onChange={(e) => updateField('secondary_color', e.target.value)}
                  className="flex-1 font-mono"
                />
              </div>
            </div>
          </div>
          
          {/* Preview */}
          <div className="mt-4 p-4 border rounded-lg">
            <p className="text-sm text-slate-500 mb-2">Preview:</p>
            <div 
              className="h-12 rounded-lg flex items-center px-4"
              style={{ backgroundColor: profile.primary_color }}
            >
              <span className="text-white font-medium">
                {profile.company_name || 'Your Company'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="street_address">Street Address</Label>
              <Input
                id="street_address"
                value={profile.street_address || ''}
                onChange={(e) => updateField('street_address', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apartment">Apt/Suite</Label>
              <Input
                id="apartment"
                value={profile.apartment || ''}
                onChange={(e) => updateField('apartment', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={profile.city || ''}
                onChange={(e) => updateField('city', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={profile.state || ''}
                onChange={(e) => updateField('state', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip_code">ZIP Code</Label>
              <Input
                id="zip_code"
                value={profile.zip_code || ''}
                onChange={(e) => updateField('zip_code', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
