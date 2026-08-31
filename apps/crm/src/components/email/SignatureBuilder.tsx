'use client';

import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import { toastCopy } from '@/lib/crm/toast-copy';
import { useState, useCallback, useEffect, useMemo } from 'react';
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
import { ImageUploader } from './ImageUploader';
import {
  DEFAULT_PIFH_LOGO_PATH,
  SIGNATURE_LAYOUTS,
  type SignatureFields,
  absolutizeSignatureHtml,
  getSignatureOrigin,
  renderFullImageSignature,
  renderLayoutHtml,
} from '@/lib/email/signature-html';

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

export interface SignatureDefaults {
  full_name?: string;
  email?: string;
  phone?: string;
  title?: string;
  company_name?: string;
  website?: string;
  logo_url?: string;
  photo_url?: string;
}

interface SignatureBuilderProps {
  signature?: SignatureData;
  onSave: (signature: SignatureData) => Promise<void>;
  onCancel: () => void;
  defaults?: SignatureDefaults;
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

type UploadTarget = 'logo' | 'photo' | 'full';

const PIFH_LAYOUTS = SIGNATURE_LAYOUTS.filter((layout) => layout.group === 'pifh');
const CUSTOM_LAYOUTS = SIGNATURE_LAYOUTS.filter((layout) => layout.group === 'custom');

function mergeInitialFields(
  signature: SignatureData | undefined,
  defaults: SignatureDefaults | undefined,
  userProfile: SignatureBuilderProps['userProfile'],
  companyInfo: SignatureBuilderProps['companyInfo'],
): SignatureFields {
  return {
    full_name: defaults?.full_name || userProfile?.full_name || '',
    title: defaults?.title || userProfile?.title || '',
    email: defaults?.email || userProfile?.email || '',
    phone: defaults?.phone || userProfile?.phone || '',
    company_name: defaults?.company_name || companyInfo?.name || '',
    website: defaults?.website || companyInfo?.website || '',
    logo_url: signature?.logo_url || defaults?.logo_url || DEFAULT_PIFH_LOGO_PATH,
    photo_url: signature?.photo_url || defaults?.photo_url || '',
  };
}

function htmlFromFields(layoutId: string | null, fields: SignatureFields): string {
  if (!layoutId || layoutId === 'full-image') return '';
  return renderLayoutHtml(layoutId, fields) || '';
}

export function SignatureBuilder({
  signature,
  onSave,
  onCancel,
  defaults,
  userProfile,
  companyInfo,
}: SignatureBuilderProps) {
  const [activeTab, setActiveTab] = useState('editor');
  const [saving, setSaving] = useState(false);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(
    signature?.content_html ? null : 'pifh-horizontal',
  );
  const [fields, setFields] = useState<SignatureFields>(() =>
    mergeInitialFields(signature, defaults, userProfile, companyInfo),
  );
  const [formData, setFormData] = useState<SignatureData>(() => {
    const initialFields = mergeInitialFields(signature, defaults, userProfile, companyInfo);
    const initialHtml =
      signature?.content_html ||
      renderLayoutHtml('pifh-horizontal', initialFields) ||
      '';
    return {
      name: signature?.name || 'My Signature',
      content_html: initialHtml,
      content_text: signature?.content_text || '',
      logo_url: initialFields.logo_url,
      photo_url: initialFields.photo_url,
      social_links: signature?.social_links || {},
      is_default: signature?.is_default ?? true,
      include_in_replies: signature?.include_in_replies ?? true,
      include_in_new: signature?.include_in_new ?? true,
    };
  });
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);

  const applyLayout = useCallback((layoutId: string, nextFields: SignatureFields) => {
    const html = htmlFromFields(layoutId, nextFields);
    setSelectedLayoutId(layoutId);
    setFormData((prev) => ({
      ...prev,
      content_html: html,
      logo_url: nextFields.logo_url,
      photo_url: nextFields.photo_url,
    }));
  }, []);

  const updateField = (key: keyof SignatureFields, value: string) => {
    setFields((prev) => {
      const next = { ...prev, [key]: value };
      if (selectedLayoutId && selectedLayoutId !== 'full-image') {
        const html = htmlFromFields(selectedLayoutId, next);
        setFormData((current) => ({
          ...current,
          content_html: html,
          logo_url: next.logo_url,
          photo_url: next.photo_url,
        }));
      } else if (!selectedLayoutId) {
        applyLayout('pifh-horizontal', next);
      } else {
        setFormData((current) => ({
          ...current,
          logo_url: next.logo_url,
          photo_url: next.photo_url,
        }));
      }
      return next;
    });
  };

  const handleChange = (field: keyof SignatureData, value: string | boolean | object) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSocialLinkChange = (platform: string, url: string) => {
    setFormData((prev) => ({
      ...prev,
      social_links: { ...prev.social_links, [platform]: url },
    }));
  };

  const handleUploadedImage = (url: string, alt?: string) => {
    if (uploadTarget === 'full') {
      setSelectedLayoutId('full-image');
      setFormData((prev) => ({
        ...prev,
        content_html: renderFullImageSignature(url, alt || 'Email Signature'),
        logo_url: url,
      }));
      setFields((prev) => ({ ...prev, logo_url: url }));
      return;
    }

    if (uploadTarget === 'photo') {
      const next = { ...fields, photo_url: url };
      setFields(next);
      if (!selectedLayoutId || selectedLayoutId === 'full-image') {
        applyLayout('professional', next);
      } else {
        applyLayout(selectedLayoutId, next);
      }
      return;
    }

    const next = { ...fields, logo_url: url };
    setFields(next);
    if (!selectedLayoutId || selectedLayoutId === 'full-image') {
      applyLayout('pifh-horizontal', next);
    } else {
      applyLayout(selectedLayoutId, next);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content_html.trim()) {
      toast.error(toastCopy.failed('save the signature', 'add a name and signature content', 'Fill both fields and try again'));
      return;
    }

    setSaving(true);
    try {
      const origin = getSignatureOrigin();
      await onSave({
        ...formData,
        id: signature?.id,
        logo_url: fields.logo_url,
        photo_url: fields.photo_url,
        content_html: absolutizeSignatureHtml(formData.content_html, origin),
      });
    } catch (error) {
      console.error('Failed to save signature:', error);
      toast.error(toastCopy.failed('save the signature', error, 'Try again'));
    } finally {
      setSaving(false);
    }
  };

  const generatePlainText = useCallback(() => {
    const div = document.createElement('div');
    div.innerHTML = DOMPurify.sanitize(formData.content_html);
    return div.textContent || div.innerText || '';
  }, [formData.content_html]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      content_text: generatePlainText(),
    }));
  }, [generatePlainText]);

  const previewHtml = useMemo(
    () => DOMPurify.sanitize(formData.content_html),
    [formData.content_html],
  );

  const layoutPreview = (layoutId: string) =>
    DOMPurify.sanitize(renderLayoutHtml(layoutId, fields) || '');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {signature?.id ? 'Edit Signature' : 'Create Signature'}
          </h2>
          <p className="text-sm text-slate-500">
            Edit your name and details, then upload a logo from your computer.
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Signature Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Work Signature, Personal"
            />
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Your details</CardTitle>
              <CardDescription className="text-xs">
                These fields update the live preview. They are not locked inside an image.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0">
              <div className="space-y-2">
                <Label htmlFor="full_name">Name</Label>
                <Input
                  id="full_name"
                  value={fields.full_name}
                  onChange={(e) => updateField('full_name', e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={fields.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Your title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={fields.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={fields.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Company</Label>
                <Input
                  id="company_name"
                  value={fields.company_name}
                  onChange={(e) => updateField('company_name', e.target.value)}
                  placeholder="Company name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={fields.website}
                  onChange={(e) => updateField('website', e.target.value)}
                  placeholder="www.example.com"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-500" />
                Pay it Forward Health signatures
              </CardTitle>
              <CardDescription className="text-xs">
                Branded layouts using the current wordmark. Your details stay editable.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 gap-3">
                {PIFH_LAYOUTS.map((layout) => (
                  <button
                    key={layout.id}
                    type="button"
                    onClick={() => applyLayout(layout.id, fields)}
                    className={cn(
                      'relative rounded-lg border-2 overflow-hidden text-left transition-all hover:border-teal-500/50 bg-white dark:bg-slate-900',
                      selectedLayoutId === layout.id
                        ? 'border-teal-500 ring-2 ring-teal-500/20'
                        : 'border-slate-200 dark:border-slate-700',
                    )}
                  >
                    <div className="p-3 min-h-[88px]">
                      <div
                        className="pointer-events-none scale-[0.92] origin-top-left"
                        dangerouslySetInnerHTML={{ __html: layoutPreview(layout.id) }}
                      />
                    </div>
                    {selectedLayoutId === layout.id && (
                      <div className="absolute top-2 right-2 p-1 bg-teal-500 rounded-full">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="px-3 pb-2">
                      <p className="font-medium text-sm">{layout.name}</p>
                      <p className="text-xs text-slate-500">{layout.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Palette className="w-4 h-4" />
                More layouts
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2">
                {CUSTOM_LAYOUTS.map((layout) => (
                  <Button
                    key={layout.id}
                    type="button"
                    variant={selectedLayoutId === layout.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => applyLayout(layout.id, fields)}
                    className="justify-start h-auto py-2 overflow-hidden"
                  >
                    <div className="text-left min-w-0">
                      <p className="font-medium truncate">{layout.name}</p>
                      <p className="text-xs text-slate-500 truncate">{layout.description}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

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
                <Card className="border-dashed">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Images
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Upload a file from your computer. URL paste still works if you already have one.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setUploadTarget('logo')}
                      >
                        <Upload className="w-4 h-4" />
                        Upload logo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setUploadTarget('photo')}
                      >
                        <Upload className="w-4 h-4" />
                        Upload photo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setUploadTarget('full')}
                      >
                        <Upload className="w-4 h-4" />
                        Upload full signature image
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="photo_url" className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" />
                          Photo URL
                        </Label>
                        <Input
                          id="photo_url"
                          value={fields.photo_url}
                          onChange={(e) => updateField('photo_url', e.target.value)}
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
                          value={fields.logo_url}
                          onChange={(e) => updateField('logo_url', e.target.value)}
                          placeholder="https://... or /signatures/pifh-logo.png"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Social Links</CardTitle>
                    <CardDescription className="text-xs">
                      Stored with the signature for later use
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
                onChange={(e) => {
                  setSelectedLayoutId(null);
                  handleChange('content_html', e.target.value);
                }}
                className="font-mono text-sm min-h-[300px]"
                placeholder="Enter HTML for your signature..."
              />
            </TabsContent>
          </Tabs>

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
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                ) : (
                  <p className="text-sm text-slate-400 italic">
                    Your signature preview will appear here...
                  </p>
                )}
              </div>

              <div className="mt-4">
                <p className="text-xs text-slate-500 mb-2">Dark Mode Preview</p>
                <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg min-h-[200px]">
                  {formData.content_html ? (
                    <div
                      className="[&_*]:!text-slate-200"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
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

      <ImageUploader
        open={uploadTarget !== null}
        onOpenChange={(open) => {
          if (!open) setUploadTarget(null);
        }}
        folder="signatures"
        title={
          uploadTarget === 'photo'
            ? 'Upload photo'
            : uploadTarget === 'full'
              ? 'Upload signature image'
              : 'Upload logo'
        }
        description="Choose a file from your computer, or paste an image URL."
        insertLabel="Use image"
        onImageInsert={handleUploadedImage}
      />
    </div>
  );
}

export default SignatureBuilder;
