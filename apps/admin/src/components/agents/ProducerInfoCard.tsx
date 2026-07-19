'use client';

import { ArrowSquareOut, Check, Minus } from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import Link from 'next/link';
import { format } from 'date-fns';

interface ProducerInfoAgent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  mobile_phone: string | null;
  status: string;
  advisor_code: string | null;
  producer_code: string | null;
  admin123_agent_id: string | null;
  producer_type: string | null;
  website_url: string | null;
  master_click_funnel: string | null;
  mpb_certified: boolean | null;
  mpb_eo_current: boolean | null;
  crm_owner: boolean | null;
  setup_fee_waived: boolean | null;
  compliance_training_completed: string | null;
  created_at: string;
  updated_at: string;
  parent_advisor?: { id: string; first_name: string; last_name: string } | null;
  producer_owner?: { id: string; first_name: string; last_name: string; agent_role?: string } | null;
  referring_affiliate?: { id: string; first_name: string; last_name: string } | null;
}

interface ProducerInfoCardProps {
  agent: ProducerInfoAgent;
}

function BoolField({ value, label }: { value: boolean | null; label?: string }) {
  if (value) {
    return (
      <span className="flex items-center gap-1.5 text-green-600">
        <Check weight="light" className="h-4 w-4" />
        {label && <span className="text-sm">{label}</span>}
      </span>
    );
  }
  return <span className="text-slate-400"><Minus weight="light" className="h-4 w-4" /></span>;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start py-2.5 border-b border-slate-100 last:border-b-0">
      <span className="text-sm text-slate-500 w-48 shrink-0 text-right pr-4">{label}</span>
      <span className="text-sm font-medium text-slate-900 flex-1">{children}</span>
    </div>
  );
}

export function ProducerInfoCard({ agent }: ProducerInfoCardProps) {
  const producerOwnerName = agent.producer_owner
    ? `${agent.producer_owner.first_name} ${agent.producer_owner.last_name}${agent.producer_owner.agent_role ? ` - ${agent.producer_owner.agent_role}` : ''}`
    : null;

  const producerName = `${agent.first_name} ${agent.last_name}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Producer Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Left Column */}
          <div className="pr-6 border-r border-slate-100">
            <InfoRow label="Producer Owner">
              {producerOwnerName ? (
                <Link
                  href={`/agents/${agent.producer_owner!.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {producerOwnerName}
                </Link>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </InfoRow>

            <InfoRow label="Producer Name">
              {producerName}
            </InfoRow>

            <InfoRow label="Producer Code">
              <span className="font-mono">{agent.producer_code || '—'}</span>
            </InfoRow>

            <InfoRow label="Admin123 Agent ID Number">
              <span className="font-mono">{agent.admin123_agent_id || '—'}</span>
            </InfoRow>

            <InfoRow label="Parent Producer">
              {agent.parent_advisor ? (
                <Link
                  href={`/agents/${agent.parent_advisor.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {agent.parent_advisor.first_name} {agent.parent_advisor.last_name}
                </Link>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </InfoRow>

            <InfoRow label="Producer Type">
              {agent.producer_type || '—'}
            </InfoRow>

            <InfoRow label="Created By">
              <div>
                <span>{format(new Date(agent.created_at), 'EEE, d MMM yyyy hh:mm a')}</span>
              </div>
            </InfoRow>

            <InfoRow label="Producer Status">
              <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
              </Badge>
            </InfoRow>

            <InfoRow label="Master Click Funnel">
              {agent.master_click_funnel ? (
                <a
                  href={agent.master_click_funnel.startsWith('http') ? agent.master_click_funnel : `https://${agent.master_click_funnel}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  {agent.master_click_funnel}
                  <ArrowSquareOut weight="light" className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </InfoRow>

            <InfoRow label="MPB E&O Current">
              <BoolField value={agent.mpb_eo_current} />
            </InfoRow>
          </div>

          {/* Right Column */}
          <div className="pl-6">
            <InfoRow label="Phone">
              {agent.phone ? (
                <a href={`tel:${agent.phone}`} className="text-blue-600 hover:underline">
                  {agent.phone}
                </a>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </InfoRow>

            <InfoRow label="Mobile">
              {agent.mobile_phone ? (
                <a href={`tel:${agent.mobile_phone}`} className="text-blue-600 hover:underline">
                  {agent.mobile_phone}
                </a>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </InfoRow>

            <InfoRow label="Email Address">
              <a href={`mailto:${agent.email}`} className="text-blue-600 hover:underline">
                {agent.email}
              </a>
            </InfoRow>

            <InfoRow label="CRM Owner">
              <BoolField value={agent.crm_owner} />
            </InfoRow>

            <InfoRow label="MPB Certified">
              <BoolField value={agent.mpb_certified} />
            </InfoRow>

            <InfoRow label="Referring Affiliate">
              {agent.referring_affiliate ? (
                <Link
                  href={`/agents/${agent.referring_affiliate.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {agent.referring_affiliate.first_name} {agent.referring_affiliate.last_name}
                </Link>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </InfoRow>

            <InfoRow label="Setup Fee Waived">
              <BoolField value={agent.setup_fee_waived} />
            </InfoRow>

            <InfoRow label="Compliance Training Completed">
              {agent.compliance_training_completed
                ? format(new Date(agent.compliance_training_completed), 'MMM d, yyyy')
                : <span className="text-slate-400">—</span>
              }
            </InfoRow>

            <InfoRow label="Modified By">
              <span>{format(new Date(agent.updated_at), 'EEE, d MMM yyyy hh:mm a')}</span>
            </InfoRow>

            <InfoRow label="Website">
              {agent.website_url ? (
                <a
                  href={agent.website_url.startsWith('http') ? agent.website_url : `https://${agent.website_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  {agent.website_url}
                  <ArrowSquareOut weight="light" className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </InfoRow>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
