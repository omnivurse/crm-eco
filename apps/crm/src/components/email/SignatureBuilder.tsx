'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Switch } from '@crm-eco/ui/components/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crm-eco/ui/components/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui/components/tabs';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Save,
  Image as ImageIcon,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Globe,
  Eye,
  Code,
  Palette,
  Loader2,
  Upload,
  Check,
  Sparkles,
} from 'lucide-react';

interface SignatureData {
  id?: string;
  name: string;
  content_html: string;
  content_text?: string;
  logo_url?: string;
  photo_url?: string;
  social_links: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    website?: string;
  };
  is_default: boolean;
  include_in_replies: boolean;
  include_in_new: boolean;
}

interface SignatureBuilderProps {
  signature?: SignatureData;
  onSave: (signature: SignatureData) => Promise<void>;
  onCancel: () => void;
  userProfile?: {
    full_name?: string;
    email?: string;
    phone?: string;
    title?: string;
  };
  companyInfo?: {
    name?: string;
    website?: string;
    address?: string;
    phone?: string;
  };
}

// Preset Pay It Forward HealthShare signature images
const PRESET_SIGNATURES = [
  {
    id: 'pif-horizontal',
    name: 'Horizontal',
    description: 'Wide banner style with tagline',
    image: '/signatures/EmailSignature-01.jpg',
  },
  {
    id: 'pif-gradient',
    name: 'Gradient',
    description: 'Modern gradient background',
    image: '/signatures/EmailSignature-02.jpg',
  },
  {
    id: 'pif-stacked',
    name: 'Stacked',
    description: 'Vertical logo with tagline',
    image: '/signatures/EmailSignature-03.jpg',
  },
];

const SIGNATURE_TEMPLATES = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Clean and professional with contact info',
    template: `<table style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <tr>
    <td style="padding-right: 15px; border-right: 2px solid #0d9488;">
      <img src="{{photo_url}}" alt="Photo" width="80" height="80" style="border-radius: 50%; display: block;" />
    </td>
    <td style="padding-left: 15px;">
      <p style="margin: 0 0 4px 0; font-weight: bold; font-size: 16px; color: #111;">{{full_name}}</p>
      <p style="margin: 0 0 8px 0; color: #666;">{{title}}</p>
      <p style="margin: 0 0 2px 0;">{{email}}</p>
      <p style="margin: 0;">{{phone}}</p>
    </td>
  </tr>
</table>`,
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Modern style with social icons',
    template: `<table style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <tr>
    <td>
      <p style="margin: 0 0 4px 0; font-weight: bold; font-size: 16px; color: #0d9488;">{{full_name}}</p>
      <p style="margin: 0 0 8px 0; color: #666;">{{title}} at {{company_name}}</p>
      <table>
        <tr>
          <td style="padding-right: 8px;"><a href="mailto:{{email}}" style="color: #0d9488;">Email</a></td>
          <td style="padding-right: 8px;"><a href="tel:{{phone}}" style="color: #0d9488;">Phone</a></td>
          <td><a href="{{website}}" style="color: #0d9488;">Website</a></td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple text-only signature',
    template: `<p style="font-family: Arial, sans-serif; font-size: 14px; color: #333; margin: 0;">
  <strong>{{full_name}}</strong><br />
  {{title}}<br />
  {{email}} | {{phone}}
</p>`,
  },
  {
    id: 'branded',
    name: 'Branded',
    description: 'With company logo and branding',
    template: `<table style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <tr>
    <td style="padding-bottom: 10px;">
      <img src="{{logo_url}}" alt="Logo" height="40" style="display: block;" />
    </td>
  </tr>
  <tr>
    <td style="border-top: 2px solid #0d9488; padding-top: 10px;">
      <p style="margin: 0 0 4px 0; font-weight: bold;">{{full_name}}</p>
      <p style="margin: 0 0 4px 0; color: #666;">{{title}}</p>
      <p style="margin: 0 0 2px 0;">{{email}} | {{phone}}</p>
      <p style="margin: 0; color: #666;">{{company_name}} | {{website}}</p>
    </td>
  </tr>
</table>`,
  },
];

export function SignatureBuilder({
  signature,
  onSave,
  onCancel,
  userProfile,
  companyInfo,
}: SignatureBuilderProps) {
  const [activeTab, setActiveTab] = useState('editor');
  const [saving, setSaving] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [signatureMode, setSignatureMode] = useState<'preset' | 'custom'>('custom');
  const [formData, setFormData] = useState<SignatureData>({
    name: signature?.name || 'My Signature',
    content_html: signature?.content_html || '',
    content_text: signature?.content_text || '',
    logo_url: signature?.logo_url || '',
    photo_url: signature?.photo_url || '',
    social_links: signature?.social_links || {},
    is_default: signature?.is_default ?? true,
    include_in_replies: signature?.include_in_replies ?? true,
    include_in_new: signature?.include_in_new ?? true,
  });

  const handleChange = (field: keyof SignatureData, value: string | boolean | object) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSocialLinkChange = (platform: string, url: string) => {
    setFormData((prev) => ({
      ...prev,
      social_links: { ...prev.social_links, [platform]: url },
    }));
  };

  const applyTemplate = (templateId: string) => {
    const template = SIGNATURE_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      let html = template.template;
      // Replace placeholders with actual values
      html = html.replace(/\{\{full_name\}\}/g, userProfile?.full_name || 'Your Name');
      html = html.replace(/\{\{email\}\}/g, userProfile?.email || 'email@example.com');
      html = html.replace(/\{\{phone\}\}/g, userProfile?.phone || '(555) 123-4567');
      html = html.replace(/\{\{title\}\}/g, userProfile?.title || 'Your Title');
      html = html.replace(/\{\{company_name\}\}/g, companyInfo?.name || 'Company Name');
      html = html.replace(/\{\{website\}\}/g, companyInfo?.website || 'www.example.com');
      html = html.replace(/\{\{photo_url\}\}/g, formData.photo_url || 'https://placehold.co/80x80');
      html = html.replace(/\{\{logo_url\}\}/g, formData.logo_url || 'https://placehold.co/200x40');

      setFormData((prev) => ({ ...prev, content_html: html }));
    }
  };

  const applyPresetSignature = (presetId: string) => {
    const preset = PRESET_SIGNATURES.find((p) => p.id === presetId);
    if (preset) {
      setSelectedPreset(presetId);
      setSignatureMode('preset');
      // Create HTML with the preset image
      const html = `<table style="font-family: Arial, sans-serif;">
  <tr>
    <td>
      <img src="${preset.image}" alt="Pay It Forward HealthShare" style="max-width: 100%; height: auto; display: block;" />
    </td>
  </tr>
</table>`;
      setFormData((prev) => ({ ...prev, content_html: html }));
    }
  };

  const switchToCustomMode = () => {
    setSignatureMode('custom');
    setSelectedPreset(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content_html.trim()) {
      alert('Please provide a name and signature content.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...formData,
        id: signature?.id,
      });
    } catch (error) {
      console.error('Failed to save signature:', error);
      alert('Failed to save signature. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const generatePlainText = useCallback(() => {
    // Strip HTML tags for plain text version
    const div = document.createElement('div');
    div.innerHTML = formData.content_html;
    return div.textContent || div.innerText || '';
  }, [formData.content_html]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      content_text: generatePlainText(),
    }));
  }, [generatePlainText]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {signature?.id ? 'Edit Signature' : 'Create Signature'}
          </h2>
          <p className="text-sm text-slate-500">
            Design your email signature with rich formatting and images.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Signature
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Editor */}
        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Signature Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Work Signature, Personal"
            />
          </div>

          {/* Preset Signatures */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-500" />
                Pay It Forward Signatures
              </CardTitle>
              <CardDescription className="text-xs">
                Choose a pre-designed branded signature
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 gap-3">
                {PRESET_SIGNATURES.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPresetSignature(preset.id)}
                    className={cn(
                      'relative rounded-lg border-2 overflow-hidden transition-all hover:border-teal-500/50 group',
                      selectedPreset === preset.id
                        ? 'border-teal-500 ring-2 ring-teal-500/20'
                        : 'border-slate-200 dark:border-slate-700'
                    )}
                  >
                    <img
                      src={preset.image}
                      alt={preset.name}
                      className="w-full h-auto"
                    />
                    {selectedPreset === preset.id && (
                      <div className="absolute top-2 right-2 p-1 bg-teal-500 rounded-full">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                      <div className="p-2 text-white text-left">
                        <p className="font-medium text-sm">{preset.name}</p>
                        <p className="text-xs text-white/80">{preset.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {selectedPreset && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={switchToCustomMode}
                  className="mt-3 w-full text-slate-500"
                >
                  Switch to custom signature
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Custom Templates */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Custom Templates
              </CardTitle>
              <CardDescription className="text-xs">
                Build your own signature from a template
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2">
                {SIGNATURE_TEMPLATES.map((template) => (
                  <Button
                    key={template.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      applyTemplate(template.id);
                      switchToCustomMode();
                    }}
                    className="justify-start h-auto py-2 overflow-hidden"
                  >
                    <div className="text-left min-w-0">
                      <p className="font-medium truncate">{template.name}</p>
                      <p className="text-xs text-slate-500 truncate">{template.description}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tabs: Editor / Source */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="editor" className="gap-2">
                <Eye className="w-4 h-4" />
                Visual Editor
              </TabsTrigger>
              <TabsTrigger value="source" className="gap-2">
                <Code className="w-4 h-4" />
                HTML Source
              </TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="mt-4">
              <div className="space-y-4">
                {/* Custom Signature Image Upload */}
                <Card className="border-dashed">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Upload Custom Signature Image
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Upload your own signature image (JPG, PNG, GIF)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="custom_signature_url">Image URL</Label>
                      <Input
                        id="custom_signature_url"
                        placeholder="https://... or paste image URL"
                        onChange={(e) => {
                          if (e.target.value) {
                            switchToCustomMode();
                            const html = `<table style="font-family: Arial, sans-serif;">
  <tr>
    <td>
      <img src="${e.target.value}" alt="Email Signature" style="max-width: 100%; height: auto; display: block;" />
    </td>
  </tr>
</table>`;
                            setFormData((prev) => ({ ...prev, content_html: html }));
                          }
                        }}
                      />
                      <p className="text-xs text-slate-500">
                        Tip: Upload your image to the Asset Library first, then paste the URL here
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Image URLs for templates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="photo_url" className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Photo URL
                    </Label>
                    <Input
                      id="photo_url"
                      value={formData.photo_url}
                      onChange={(e) => handleChange('photo_url', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logo_url" className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Logo URL
                    </Label>
                    <Input
                      id="logo_url"
                      value={formData.logo_url}
                      onChange={(e) => handleChange('logo_url', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Social Links */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Social Links</CardTitle>
                    <CardDescription className="text-xs">
                      Add links to your social profiles
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex items-center gap-2">
                      <Linkedin className="w-4 h-4 text-[#0077b5]" />
                      <Input
                        value={formData.social_links.linkedin || ''}
                        onChange={(e) => handleSocialLinkChange('linkedin', e.target.value)}
                        placeholder="LinkedIn URL"
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Twitter className="w-4 h-4 text-[#1da1f2]" />
                      <Input
                        value={formData.social_links.twitter || ''}
                        onChange={(e) => handleSocialLinkChange('twitter', e.target.value)}
                        placeholder="Twitter URL"
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Facebook className="w-4 h-4 text-[#1877f2]" />
                      <Input
                        value={formData.social_links.facebook || ''}
                        onChange={(e) => handleSocialLinkChange('facebook', e.target.value)}
                        placeholder="Facebook URL"
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Instagram className="w-4 h-4 text-[#e4405f]" />
                      <Input
                        value={formData.social_links.instagram || ''}
                        onChange={(e) => handleSocialLinkChange('instagram', e.target.value)}
                        placeholder="Instagram URL"
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-slate-500" />
                      <Input
                        value={formData.social_links.website || ''}
                        onChange={(e) => handleSocialLinkChange('website', e.target.value)}
                        placeholder="Website URL"
                        className="flex-1"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="source" className="mt-4">
              <Textarea
                value={formData.content_html}
                onChange={(e) => handleChange('content_html', e.target.value)}
                className="font-mono text-sm min-h-[300px]"
                placeholder="Enter HTML for your signature..."
              />
            </TabsContent>
          </Tabs>

          {/* Settings */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Signature Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_default">Default Signature</Label>
                  <p className="text-xs text-slate-500">Use this signature by default</p>
                </div>
                <Switch
                  id="is_default"
                  checked={formData.is_default}
                  onCheckedChange={(checked) => handleChange('is_default', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="include_new">Include in New Emails</Label>
                  <p className="text-xs text-slate-500">Auto-add to new email compositions</p>
                </div>
                <Switch
                  id="include_new"
                  checked={formData.include_in_new}
                  onCheckedChange={(checked) => handleChange('include_in_new', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="include_replies">Include in Replies</Label>
                  <p className="text-xs text-slate-500">Auto-add when replying to emails</p>
                </div>
                <Switch
                  id="include_replies"
                  checked={formData.include_in_replies}
                  onCheckedChange={(checked) => handleChange('include_in_replies', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-white border border-slate-200 rounded-lg min-h-[200px]">
                {formData.content_html ? (
                  <div dangerouslySetInnerHTML={{ __html: formData.content_html }} />
                ) : (
                  <p className="text-sm text-slate-400 italic">
                    Your signature preview will appear here...
                  </p>
                )}
              </div>

              {/* Dark Mode Preview */}
              <div className="mt-4">
                <p className="text-xs text-slate-500 mb-2">Dark Mode Preview</p>
                <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg min-h-[200px]">
                  {formData.content_html ? (
                    <div
                      className="[&_*]:!text-slate-200"
                      dangerouslySetInnerHTML={{ __html: formData.content_html }}
                    />
                  ) : (
                    <p className="text-sm text-slate-500 italic">
                      Your signature preview will appear here...
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default SignatureBuilder;
