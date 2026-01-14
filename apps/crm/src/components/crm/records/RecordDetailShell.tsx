'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft,
  Edit,
  UserPlus,
  CheckSquare,
  StickyNote,
  Upload,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  Users,
  DollarSign,
  UserCircle,
  Clock,
  Link2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@crm-eco/ui/components/tabs';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { ActionRail } from '@/components/layout/ActionRail';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmRecord, CrmModule, CrmField, CrmDealStage } from '@/lib/crm/types';

interface RecordDetailShellProps {
  record: CrmRecord;
  module: CrmModule;
  fields: CrmField[];
  stages?: CrmDealStage[];
  children: {
    overview: React.ReactNode;
    related: React.ReactNode;
    timeline: React.ReactNode;
    notes?: React.ReactNode;
    attachments?: React.ReactNode;
  };
  onEdit?: () => void;
  onAddTask?: () => void;
  onAddNote?: () => void;
  onUploadFile?: () => void;
  className?: string;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <Users className="w-5 h-5" />,
  leads: <UserPlus className="w-5 h-5" />,
  deals: <DollarSign className="w-5 h-5" />,
  accounts: <Building2 className="w-5 h-5" />,
};

const MODULE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  contacts: { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  leads: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  deals: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  accounts: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
};

function StageIndicator({ 
  currentStage, 
  stages 
}: { 
  currentStage: string | null; 
  stages: CrmDealStage[] 
}) {
  if (!stages.length || !currentStage) return null;

  const currentIndex = stages.findIndex(s => s.key === currentStage);
  const current = stages[currentIndex];

  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, index) => {
        const isActive = index === currentIndex;
        const isPast = index < currentIndex;
        const isWon = stage.is_won;
        const isLost = stage.is_lost;

        let bgColor = 'bg-slate-700';
        if (isActive) {
          bgColor = isWon ? 'bg-green-500' : isLost ? 'bg-red-500' : 'bg-teal-500';
        } else if (isPast) {
          bgColor = 'bg-teal-500/50';
        }

        return (
          <div
            key={stage.id}
            className={cn(
              'h-2 flex-1 rounded-full transition-colors',
              bgColor
            )}
            title={stage.name}
          />
        );
      })}
    </div>
  );
}

export function RecordDetailShell({
  record,
  module,
  fields,
  stages = [],
  children,
  onEdit,
  onAddTask,
  onAddNote,
  onUploadFile,
  className,
}: RecordDetailShellProps) {
  const [activeTab, setActiveTab] = useState('overview');
  
  const icon = MODULE_ICONS[module.key] || <UserCircle className="w-5 h-5" />;
  const colors = MODULE_COLORS[module.key] || MODULE_COLORS.contacts;

  const backUrl = `/crm/modules/${module.key}`;
  const isDeals = module.key === 'deals';

  return (
    <div className={cn('flex h-full', className)}>
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-6xl mx-auto px-6 py-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-4">
              <Link 
                href={backUrl}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {module.name_plural || module.name}
              </Link>
              <span className="text-slate-600">/</span>
              <span className="text-sm text-white truncate max-w-xs">
                {record.title || 'Untitled'}
              </span>
            </div>

            {/* Title Row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn('p-3 rounded-xl', colors.bg, colors.text)}>
                  {icon}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {record.title || 'Untitled'}
                  </h1>
                  <div className="flex items-center gap-3 mt-1">
                    {record.email && (
                      <a 
                        href={`mailto:${record.email}`}
                        className="flex items-center gap-1 text-sm text-slate-400 hover:text-teal-400 transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {record.email}
                      </a>
                    )}
                    {record.phone && (
                      <a 
                        href={`tel:${record.phone}`}
                        className="flex items-center gap-1 text-sm text-slate-400 hover:text-teal-400 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {record.phone}
                      </a>
                    )}
                    {record.status && (
                      <Badge variant="outline" className="bg-slate-800/50 border-slate-600 text-slate-300">
                        {record.status}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="glass border-white/10 text-slate-300 hover:text-white"
                  onClick={onEdit}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-white"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-card border-white/10">
                    <DropdownMenuItem className="text-slate-300 focus:text-white focus:bg-white/10">
                      Clone Record
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-slate-300 focus:text-white focus:bg-white/10">
                      Print
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem className="text-red-400 focus:text-red-300 focus:bg-red-500/10">
                      Delete Record
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Stage Progress (for Deals) */}
            {isDeals && stages.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Pipeline Progress</span>
                  {record.stage && (
                    <span className="text-sm font-medium text-white">
                      {stages.find(s => s.key === record.stage)?.name || record.stage}
                    </span>
                  )}
                </div>
                <StageIndicator currentStage={record.stage} stages={stages} />
              </div>
            )}

            {/* Tabs */}
            <div className="mt-6 -mb-px">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-transparent border-b border-white/5 w-full justify-start gap-0 h-auto p-0">
                  <TabsTrigger 
                    value="overview"
                    className="px-4 py-3 text-sm font-medium text-slate-400 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-white transition-colors"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger 
                    value="related"
                    className="px-4 py-3 text-sm font-medium text-slate-400 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-white transition-colors"
                  >
                    <Link2 className="w-4 h-4 mr-1.5" />
                    Related
                  </TabsTrigger>
                  <TabsTrigger 
                    value="timeline"
                    className="px-4 py-3 text-sm font-medium text-slate-400 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-white transition-colors"
                  >
                    <Clock className="w-4 h-4 mr-1.5" />
                    Timeline
                  </TabsTrigger>
                  {children.notes && (
                    <TabsTrigger 
                      value="notes"
                      className="px-4 py-3 text-sm font-medium text-slate-400 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-white transition-colors"
                    >
                      <StickyNote className="w-4 h-4 mr-1.5" />
                      Notes
                    </TabsTrigger>
                  )}
                  {children.attachments && (
                    <TabsTrigger 
                      value="attachments"
                      className="px-4 py-3 text-sm font-medium text-slate-400 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-white transition-colors"
                    >
                      <Upload className="w-4 h-4 mr-1.5" />
                      Files
                    </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-6xl mx-auto px-6 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="overview" className="mt-0">
              {children.overview}
            </TabsContent>
            <TabsContent value="related" className="mt-0">
              {children.related}
            </TabsContent>
            <TabsContent value="timeline" className="mt-0">
              {children.timeline}
            </TabsContent>
            {children.notes && (
              <TabsContent value="notes" className="mt-0">
                {children.notes}
              </TabsContent>
            )}
            {children.attachments && (
              <TabsContent value="attachments" className="mt-0">
                {children.attachments}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>

      {/* Action Rail */}
      <ActionRail title="Quick Actions" width="sm" defaultCollapsed={false}>
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start glass border-white/10 text-slate-300 hover:text-white hover:border-white/20"
            onClick={onEdit}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Record
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start glass border-white/10 text-slate-300 hover:text-white hover:border-white/20"
            onClick={onAddTask}
          >
            <CheckSquare className="w-4 h-4 mr-2" />
            Add Task
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start glass border-white/10 text-slate-300 hover:text-white hover:border-white/20"
            onClick={onAddNote}
          >
            <StickyNote className="w-4 h-4 mr-2" />
            Add Note
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start glass border-white/10 text-slate-300 hover:text-white hover:border-white/20"
            onClick={onUploadFile}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload File
          </Button>

          <div className="border-t border-white/10 pt-3 mt-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Record Info
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-300">
                  {new Date(record.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Updated</span>
                <span className="text-slate-300">
                  {new Date(record.updated_at).toLocaleDateString()}
                </span>
              </div>
              {record.owner_id && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Owner</span>
                  <span className="text-slate-300">Assigned</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </ActionRail>
    </div>
  );
}
