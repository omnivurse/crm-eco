'use client';

import { useEffect, useState } from 'react';
import {
  FileText,
  Download,
  Shield,
  CircleNotch,
  Calendar,
  CheckCircle,
} from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { toast } from 'sonner';
import { getMemberDocumentsData, type IdCardData, type MemberDoc } from './actions';
import { IdCardDownloadButton } from '@/components/documents/IdCardDownloadButton';
import { PageHeader } from '@/components/PageHeader';
import { Bezel } from '@/components/ui/Bezel';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<MemberDoc[]>([]);
  const [idCard, setIdCard] = useState<IdCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    getMemberDocumentsData()
      .then((data) => {
        if (!active) return;
        setIdCard(data.idCard);
        setDocuments(data.documents);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleDownload = (doc: MemberDoc) => {
    if (doc.url) {
      window.open(doc.url, '_blank');
    } else {
      toast.error('Document not available for download');
    }
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'contract': return <CheckCircle weight="light" className="h-5 w-5 text-[var(--mp-teal)]" aria-hidden />;
      case 'guidelines': return <Shield weight="light" className="h-5 w-5 text-green-600" aria-hidden />;
      case 'guide': return <FileText weight="light" className="h-5 w-5 text-slate-600" aria-hidden />;
      case 'legal': return <FileText weight="light" className="h-5 w-5 text-slate-600" aria-hidden />;
      default: return <FileText weight="light" className="h-5 w-5 text-slate-600" aria-hidden />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <CircleNotch weight="light" className="h-8 w-8 animate-spin text-[var(--mp-teal)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <FileText weight="light" className="h-12 w-12 mx-auto mb-4 text-slate-300" aria-hidden />
        <p className="text-slate-600 mb-1">We couldn&apos;t load your documents.</p>
        <p className="text-sm text-slate-400 mb-4">Please check your connection and try again.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Access your membership documents and ID card"
      />

      {/* Member ID Card */}
      {idCard && (
        <Bezel variant="hero">
          <div className="p-6 md:p-7">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="mp-kicker mp-kicker-light mb-1">
                  Health Sharing Member ID Card
                </p>
                <h2 className="text-xl font-bold tracking-[-0.03em]">{idCard.orgName}</h2>
              </div>
              <div className="text-right">
                <Shield weight="light" className="h-10 w-10 text-white/50" aria-hidden />
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-white/65">Member Name</p>
                <p className="text-lg font-semibold">{idCard.memberName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-white/65">Member ID</p>
                <p className="font-mono text-lg font-semibold">{idCard.memberNumber}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-white/65">Plan</p>
                <p className="font-medium">{idCard.planName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-white/65">Effective Date</p>
                <p className="font-medium">
                  {idCard.effectiveDate ? new Date(idCard.effectiveDate).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/20 pt-4">
              <div>
                <p className="text-xs text-white/65">Group #: {idCard.groupNumber}</p>
              </div>
              <IdCardDownloadButton idCard={idCard} />
            </div>
          </div>
        </Bezel>
      )}

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>My Documents</CardTitle>
          <CardDescription>
            Download contracts, guides, and legal documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 && (
            <div className="text-center py-8">
              <FileText weight="light" className="h-12 w-12 mx-auto mb-4 text-slate-300" aria-hidden />
              <p className="text-slate-500 mb-2">No documents available yet</p>
              <p className="text-sm text-slate-400">
                Your contracts, guides, and legal documents will appear here
              </p>
            </div>
          )}
          <div className="space-y-3">
            {documents.map((doc) => (
              <div 
                key={doc.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[rgba(11,109,133,0.06)] flex items-center justify-center">
                    {getDocumentIcon(doc.type)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{doc.title}</p>
                    <p className="text-sm text-slate-500">
                      {doc.type === 'contract' 
                        ? `Created ${new Date(doc.created_at).toLocaleDateString()}`
                        : 'Standard document'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {doc.status === 'signed' && (
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      <CheckCircle weight="light" className="h-3 w-3 mr-1" aria-hidden />
                      Signed
                    </Badge>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDownload(doc)}
                  >
                    <Download weight="light" className="h-4 w-4 mr-2" aria-hidden />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tax Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Documents</CardTitle>
          <CardDescription>
            Annual statements for tax purposes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar weight="light" className="h-12 w-12 mx-auto mb-4 text-slate-300" aria-hidden />
            <p className="text-slate-500 mb-2">No tax documents available yet</p>
            <p className="text-sm text-slate-400">
              Annual contribution statements will appear here after year-end
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
