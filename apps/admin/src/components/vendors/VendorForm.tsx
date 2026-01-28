'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crm-eco/ui';
import { Loader2, AlertCircle } from 'lucide-react';
import { createClient } from '@crm-eco/lib/supabase/client';
import type { Vendor } from '@crm-eco/lib/types';

interface VendorFormProps {
  initialData?: Vendor | null;
}

const VENDOR_TYPES = [
  { value: 'health_plan', label: 'Health Plan' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'pharmacy_benefit', label: 'Pharmacy Benefit' },
  { value: 'ancillary', label: 'Ancillary' },
  { value: 'other', label: 'Other' },
];

const CONNECTION_TYPES = [
  { value: 'manual', label: 'Manual Upload' },
  { value: 'sftp', label: 'SFTP' },
  { value: 'api', label: 'API' },
  { value: 'webhook', label: 'Webhook' },
];

const FILE_FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel (XLSX)' },
  { value: 'xml', label: 'XML' },
  { value: 'json', label: 'JSON' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
];

export function VendorForm({ initialData }: VendorFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [vendorType, setVendorType] = useState<string>(initialData?.vendor_type || 'health_plan');
  const [status, setStatus] = useState<string>(initialData?.status || 'active');

  // Contact info
  const [contactName, setContactName] = useState(initialData?.contact_name || '');
  const [contactEmail, setContactEmail] = useState(initialData?.contact_email || '');
  const [contactPhone, setContactPhone] = useState(initialData?.contact_phone || '');
  const [websiteUrl, setWebsiteUrl] = useState(initialData?.website_url || '');

  // Connection settings
  const [connectionType, setConnectionType] = useState<string>(initialData?.connection_type || 'manual');
  const [apiEndpoint, setApiEndpoint] = useState(initialData?.api_endpoint || '');
  const [sftpHost, setSftpHost] = useState(initialData?.sftp_host || '');
  const [sftpUsername, setSftpUsername] = useState(initialData?.sftp_username || '');
  const [sftpPath, setSftpPath] = useState(initialData?.sftp_path || '');

  // Sync settings
  const [syncEnabled, setSyncEnabled] = useState(initialData?.sync_enabled || false);
  const [syncSchedule, setSyncSchedule] = useState(initialData?.sync_schedule || '');

  // File settings
  const [defaultFileFormat, setDefaultFileFormat] = useState<string>(initialData?.default_file_format || 'csv');
  const [fileDelimiter, setFileDelimiter] = useState(initialData?.file_delimiter || ',');
  const [hasHeaderRow, setHasHeaderRow] = useState(initialData?.has_header_row ?? true);
  const [dateFormat, setDateFormat] = useState(initialData?.date_format || 'YYYY-MM-DD');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      // Get user profile for org_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const sb = supabase as any;
      const profileData = profile as { id: string; organization_id: string };

      const vendorData = {
        org_id: profileData.organization_id,
        name,
        code: code.toUpperCase(),
        description: description || null,
        vendor_type: vendorType,
        status,
        contact_name: contactName || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        website_url: websiteUrl || null,
        connection_type: connectionType,
        api_endpoint: connectionType === 'api' ? apiEndpoint || null : null,
        sftp_host: connectionType === 'sftp' ? sftpHost || null : null,
        sftp_username: connectionType === 'sftp' ? sftpUsername || null : null,
        sftp_path: connectionType === 'sftp' ? sftpPath || null : null,
        sync_enabled: syncEnabled,
        sync_schedule: syncEnabled ? syncSchedule || null : null,
        default_file_format: defaultFileFormat,
        file_delimiter: fileDelimiter,
        has_header_row: hasHeaderRow,
        date_format: dateFormat,
        updated_by: profileData.id,
      };

      if (isEditing && initialData) {
        const { error: updateError } = await sb
          .from('vendors')
          .update(vendorData)
          .eq('id', initialData.id);

        if (updateError) throw updateError;
        router.push(`/vendors/${initialData.id}`);
      } else {
        const { data: newVendor, error: insertError } = await sb
          .from('vendors')
          .insert({
            ...vendorData,
            created_by: profileData.id,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        router.push(`/vendors/${newVendor.id}`);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save vendor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Core vendor details and identification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Vendor Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Zion Health"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Vendor Code *</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g., ZION"
                required
                maxLength={20}
              />
              <p className="text-xs text-slate-500">Unique identifier for this vendor</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendorType">Vendor Type</Label>
              <Select value={vendorType} onValueChange={setVendorType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this vendor..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Vendor contact details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contact@vendor.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://vendor.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Settings</CardTitle>
          <CardDescription>Configure how data is received from this vendor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="connectionType">Connection Type</Label>
            <Select value={connectionType} onValueChange={setConnectionType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONNECTION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {connectionType === 'api' && (
            <div className="space-y-2">
              <Label htmlFor="apiEndpoint">API Endpoint</Label>
              <Input
                id="apiEndpoint"
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                placeholder="https://api.vendor.com/v1"
              />
            </div>
          )}

          {connectionType === 'sftp' && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sftpHost">SFTP Host</Label>
                <Input
                  id="sftpHost"
                  value={sftpHost}
                  onChange={(e) => setSftpHost(e.target.value)}
                  placeholder="sftp.vendor.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sftpUsername">Username</Label>
                <Input
                  id="sftpUsername"
                  value={sftpUsername}
                  onChange={(e) => setSftpUsername(e.target.value)}
                  placeholder="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sftpPath">Path</Label>
                <Input
                  id="sftpPath"
                  value={sftpPath}
                  onChange={(e) => setSftpPath(e.target.value)}
                  placeholder="/outbound/files"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <Label htmlFor="syncEnabled" className="text-base font-medium">Enable Auto-Sync</Label>
              <p className="text-sm text-slate-500">Automatically fetch files on a schedule</p>
            </div>
            <Switch
              id="syncEnabled"
              checked={syncEnabled}
              onCheckedChange={setSyncEnabled}
            />
          </div>

          {syncEnabled && (
            <div className="space-y-2">
              <Label htmlFor="syncSchedule">Sync Schedule (Cron)</Label>
              <Input
                id="syncSchedule"
                value={syncSchedule}
                onChange={(e) => setSyncSchedule(e.target.value)}
                placeholder="0 6 * * * (daily at 6 AM)"
              />
              <p className="text-xs text-slate-500">Use cron expression format</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Processing Settings */}
      <Card>
        <CardHeader>
          <CardTitle>File Processing Settings</CardTitle>
          <CardDescription>Default settings for processing vendor files</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="defaultFileFormat">Default File Format</Label>
              <Select value={defaultFileFormat} onValueChange={setDefaultFileFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILE_FORMATS.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fileDelimiter">File Delimiter</Label>
              <Input
                id="fileDelimiter"
                value={fileDelimiter}
                onChange={(e) => setFileDelimiter(e.target.value)}
                placeholder=","
                maxLength={5}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFormat">Date Format</Label>
              <Input
                id="dateFormat"
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                placeholder="YYYY-MM-DD"
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label htmlFor="hasHeaderRow" className="font-medium">Has Header Row</Label>
                <p className="text-sm text-slate-500">First row contains column names</p>
              </div>
              <Switch
                id="hasHeaderRow"
                checked={hasHeaderRow}
                onCheckedChange={setHasHeaderRow}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEditing ? 'Update Vendor' : 'Create Vendor'}
        </Button>
      </div>
    </form>
  );
}
