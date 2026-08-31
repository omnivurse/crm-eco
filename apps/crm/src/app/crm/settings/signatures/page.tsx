'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crm-eco/ui/components/card';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Plus,
  Edit2,
  Trash2,
  Star,
  Loader2,
  FileSignature,
  ArrowLeft,
} from 'lucide-react';
import { SignatureBuilder, type SignatureDefaults } from '@/components/email/SignatureBuilder';
import Link from 'next/link';
import { toast } from 'sonner';
import { toastCopy } from '@/lib/crm/toast-copy';

interface EmailSignature {
  id: string;
  name: string;
  content_html: string;
  content_text?: string;
  logo_url?: string;
  photo_url?: string;
  social_links: Record<string, string>;
  is_default: boolean;
  include_in_replies: boolean;
  include_in_new: boolean;
  created_at: string;
  updated_at: string;
}

export default function SignaturesSettingsPage() {
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSignature, setEditingSignature] = useState<EmailSignature | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<SignatureDefaults>({});

  const fetchSignatures = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/email/signatures');
      if (!response.ok) {
        throw new Error('Failed to fetch signatures');
      }

      const data = await response.json();
      setSignatures(data.signatures || []);
      if (data.defaults && typeof data.defaults === 'object') {
        setDefaults(data.defaults);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load signatures');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  const handleSaveSignature = async (signatureData: {
    id?: string;
    name: string;
    content_html: string;
    content_text?: string;
    logo_url?: string;
    photo_url?: string;
    social_links: Record<string, string>;
    is_default: boolean;
    include_in_replies: boolean;
    include_in_new: boolean;
  }) => {
    const isUpdate = !!signatureData.id;
    const url = isUpdate
      ? `/api/email/signatures/${signatureData.id}`
      : '/api/email/signatures';
    const method = isUpdate ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signatureData),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save signature');
    }

    // Refresh list
    await fetchSignatures();
    setEditingSignature(null);
    setIsCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ title: 'Delete this signature?', confirmLabel: 'Delete', destructive: true }))) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/email/signatures/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete signature');
      }

      setSignatures((prev) => prev.filter((s) => s.id !== id));
      toast.success(toastCopy.deleted('Signature'));
    } catch (err) {
      toast.error(toastCopy.failed('delete the signature', err, 'Try again'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    setSettingDefault(id);
    try {
      const response = await fetch(`/api/email/signatures/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to set default signature');
      }

      // Update local state
      setSignatures((prev) =>
        prev.map((s) => ({
          ...s,
          is_default: s.id === id,
        }))
      );
      toast.success(toastCopy.updated('Default signature'));
    } catch (err) {
      toast.error(toastCopy.failed('set the default signature', err, 'Try again'));
    } finally {
      setSettingDefault(null);
    }
  };

  // Show editor view
  if (editingSignature || isCreating) {
    return (
      <div className="w-full py-8 px-4">
        <SignatureBuilder
          signature={editingSignature || undefined}
          defaults={defaults}
          onSave={handleSaveSignature}
          onCancel={() => {
            setEditingSignature(null);
            setIsCreating(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/crm/settings">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Email Signatures
            </h1>
            <p className="text-sm text-slate-500">
              Create and manage your email signatures
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreating(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Signature
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <Button variant="outline" onClick={fetchSignatures}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : signatures.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
              <FileSignature className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No Signatures Yet
            </h3>
            <p className="text-sm text-slate-500 mb-4 text-center max-w-sm">
              Create your first email signature to automatically add it to your outgoing emails.
            </p>
            <Button onClick={() => setIsCreating(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Your First Signature
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {signatures.map((signature) => (
            <Card key={signature.id} className="overflow-hidden">
              <div className="flex">
                {/* Signature Preview */}
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        {signature.name}
                      </h3>
                      {signature.is_default && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="w-3 h-3 fill-current" />
                          Default
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!signature.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(signature.id)}
                          disabled={settingDefault === signature.id}
                          className="text-xs"
                        >
                          {settingDefault === signature.id ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Star className="w-3 h-3 mr-1" />
                          )}
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingSignature(signature)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(signature.id)}
                        disabled={deletingId === signature.id}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        {deletingId === signature.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Preview */}
                  <div
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
                    style={{ maxHeight: 150 }}
                  >
                    <div
                      className="text-sm transform scale-90 origin-top-left"
                      dangerouslySetInnerHTML={{ __html: signature.content_html }}
                    />
                  </div>

                  {/* Settings badges */}
                  <div className="flex gap-2 mt-3">
                    {signature.include_in_new && (
                      <Badge variant="outline" className="text-xs">
                        New emails
                      </Badge>
                    )}
                    {signature.include_in_replies && (
                      <Badge variant="outline" className="text-xs">
                        Replies
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tips Section */}
      <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Tips for Email Signatures</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
          <p>
            <strong>Keep it professional:</strong> Include your name, title, and contact information.
          </p>
          <p>
            <strong>Add your photo:</strong> A professional headshot helps build trust and recognition.
          </p>
          <p>
            <strong>Include social links:</strong> Connect with recipients on LinkedIn and other platforms.
          </p>
          <p>
            <strong>Keep it concise:</strong> Aim for 3-4 lines of essential information.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
