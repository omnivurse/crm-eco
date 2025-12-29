'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { Button, Label, Textarea } from '@crm-eco/ui';
import { Send, Lock } from 'lucide-react';

interface AddCommentFormProps {
  ticketId: string;
}

export function AddCommentForm({ ticketId }: AddCommentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      
      // Get current user's profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const profile = profileData as { id: string } | null;
      if (!profile) throw new Error('Profile not found');

      // Insert comment
      const { error: insertError } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: ticketId,
          created_by_profile_id: profile.id,
          body: body.trim(),
          is_internal: isInternal,
        } as any);

      if (insertError) throw insertError;

      // Clear form and refresh
      setBody('');
      setIsInternal(false);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add comment';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="comment">Add a comment</Label>
        <Textarea
          id="comment"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type your comment here..."
          rows={3}
          required
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isInternal}
            onChange={(e) => setIsInternal(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <Lock className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-600">Internal note (not visible to member)</span>
        </label>

        <Button type="submit" disabled={loading || !body.trim()} className="gap-2">
          <Send className="w-4 h-4" />
          {loading ? 'Posting...' : 'Post Comment'}
        </Button>
      </div>
    </form>
  );
}

