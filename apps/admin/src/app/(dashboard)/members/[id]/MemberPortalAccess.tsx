'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { KeyRound, Loader2, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { inviteMemberToPortal } from '../actions';

export function MemberPortalAccess({
  memberId,
  hasLogin,
  email,
}: {
  memberId: string;
  hasLogin: boolean;
  email: string | null;
}) {
  const [linked, setLinked] = useState(hasLogin);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleInvite = async () => {
    if (!email) {
      setMsg({ ok: false, text: 'This member has no email address to invite.' });
      return;
    }
    setLoading(true);
    setMsg(null);
    const result = await inviteMemberToPortal(memberId);
    setMsg({ ok: result.ok, text: result.message });
    if (result.ok) setLinked(true);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Portal Access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {linked ? (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Has portal login
          </Badge>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              This member can&apos;t sign in to the self-service portal yet. Send an invite to
              {email ? <> <span className="font-medium">{email}</span></> : ' their email'} to create
              their login.
            </p>
            <Button onClick={handleInvite} disabled={loading || !email} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Invite to Portal
            </Button>
          </>
        )}
        {msg && (
          <div
            className={`flex items-start gap-2 text-sm ${
              msg.ok ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {msg.ok ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
