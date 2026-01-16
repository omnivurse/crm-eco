'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { 
  FileText, 
  Download,
  Eye,
  CreditCard,
  FileCheck,
  Shield,
  Loader2,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { toast } from 'sonner';

interface Document {
  id: string;
  title: string;
  type: string;
  url: string | null;
  created_at: string;
  status: string;
}

interface MemberCard {
  id: string;
  member_name: string;
  member_id: string;
  plan_name: string;
  effective_date: string;
  group_number: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [memberCard, setMemberCard] = useState<MemberCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get profile to find member
    const { data: profile } = await supabase
      .from('profiles')
      .select('member_id, organization_id')
      .eq('user_id', user.id)
      .single() as { data: { member_id: string; organization_id: string } | null };

    if (!profile?.member_id) {
      setLoading(false);
      return;
    }

    setMemberId(profile.member_id);

    // Fetch member info for ID card
    const { data: member } = await supabase
      .from('members')
      .select('id, first_name, last_name')
      .eq('id', profile.member_id)
      .single() as { data: { id: string; first_name: string; last_name: string } | null };

    // Fetch active membership for ID card
    const { data: membership } = await (supabase as any)
      .from('memberships')
      .select(`
        id,
        effective_date,
        plans (name)
      `)
      .eq('member_id', profile.member_id)
      .eq('status', 'active')
      .single();

    if (member && membership) {
      setMemberCard({
        id: member.id,
        member_name: `${member.first_name} ${member.last_name}`,
        member_id: member.id,
        plan_name: membership.plans?.name || 'Health Sharing Plan',
        effective_date: membership.effective_date,
        group_number: 'WS-001',
      });
    }

    // Fetch enrollment contracts
    const { data: contracts } = await (supabase as any)
      .from('enrollment_contracts')
      .select('*')
      .eq('member_id', profile.member_id)
      .order('created_at', { ascending: false });

    // Create document list from contracts and standard docs
    const docs: Document[] = [];

    if (contracts) {
      contracts.forEach((contract: any) => {
        docs.push({
          id: contract.id,
          title: contract.contract_type || 'Enrollment Agreement',
          type: 'contract',
          url: contract.url,
          created_at: contract.created_at,
          status: contract.status,
        });
      });
    }

    // Add standard membership documents
    docs.push(
      {
        id: 'guidelines',
        title: 'Membership Guidelines',
        type: 'guidelines',
        url: '/docs/membership-guidelines.pdf',
        created_at: new Date().toISOString(),
        status: 'available',
      },
      {
        id: 'sharing-guide',
        title: 'How Sharing Works Guide',
        type: 'guide',
        url: '/docs/sharing-guide.pdf',
        created_at: new Date().toISOString(),
        status: 'available',
      },
      {
        id: 'terms',
        title: 'Terms & Conditions',
        type: 'legal',
        url: '/docs/terms-conditions.pdf',
        created_at: new Date().toISOString(),
        status: 'available',
      },
      {
        id: 'privacy',
        title: 'Privacy Policy',
        type: 'legal',
        url: '/docs/privacy-policy.pdf',
        created_at: new Date().toISOString(),
        status: 'available',
      }
    );

    setDocuments(docs);
    setLoading(false);
  };

  const handleDownload = (doc: Document) => {
    if (doc.url) {
      window.open(doc.url, '_blank');
    } else {
      toast.error('Document not available for download');
    }
  };

  const handleDownloadIdCard = () => {
    toast.success('ID Card download started');
    // In real app, generate PDF ID card
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'contract': return <FileCheck className="h-5 w-5 text-blue-600" />;
      case 'guidelines': return <Shield className="h-5 w-5 text-green-600" />;
      case 'guide': return <FileText className="h-5 w-5 text-purple-600" />;
      case 'legal': return <FileText className="h-5 w-5 text-slate-600" />;
      default: return <FileText className="h-5 w-5 text-slate-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
        <p className="text-slate-500">Access your membership documents and ID card</p>
      </div>

      {/* Member ID Card */}
      {memberCard && (
        <Card className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-blue-200 text-xs uppercase tracking-wider mb-1">
                  Health Sharing Member ID Card
                </p>
                <h2 className="text-xl font-bold">WealthShare</h2>
              </div>
              <div className="text-right">
                <Shield className="h-10 w-10 text-blue-300" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-blue-200 text-xs uppercase tracking-wider">Member Name</p>
                <p className="font-semibold text-lg">{memberCard.member_name}</p>
              </div>
              <div>
                <p className="text-blue-200 text-xs uppercase tracking-wider">Member ID</p>
                <p className="font-mono font-semibold text-lg">{memberCard.member_id}</p>
              </div>
              <div>
                <p className="text-blue-200 text-xs uppercase tracking-wider">Plan</p>
                <p className="font-medium">{memberCard.plan_name}</p>
              </div>
              <div>
                <p className="text-blue-200 text-xs uppercase tracking-wider">Effective Date</p>
                <p className="font-medium">
                  {new Date(memberCard.effective_date).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-blue-500/30">
              <div>
                <p className="text-blue-200 text-xs">Group #: {memberCard.group_number}</p>
              </div>
              <Button 
                variant="secondary" 
                size="sm" 
                className="bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={handleDownloadIdCard}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Card
              </Button>
            </div>
          </CardContent>
        </Card>
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
          <div className="space-y-3">
            {documents.map((doc) => (
              <div 
                key={doc.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
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
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Signed
                    </Badge>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDownload(doc)}
                  >
                    <Download className="h-4 w-4 mr-2" />
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
            <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-300" />
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
