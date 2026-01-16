'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { 
  ChevronDown, 
  CheckCircle2, 
  AlertCircle,
  Lock,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { TransitionGateDialog } from './TransitionGateDialog';
import type { AvailableTransition } from '@/lib/blueprints/types';

interface StageSelectorProps {
  recordId: string;
  currentStage: string | null;
  currentStageLabel?: string;
  currentStageColor?: string;
  moduleId: string;
  onStageChange?: (newStage: string) => void;
  disabled?: boolean;
  className?: string;
}

interface TransitionInfo extends AvailableTransition {
  canTransition: boolean;
  blockingReason?: string;
}

export function StageSelector({
  recordId,
  currentStage,
  currentStageLabel,
  currentStageColor,
  moduleId,
  onStageChange,
  disabled,
  className,
}: StageSelectorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [transitions, setTransitions] = useState<TransitionInfo[]>([]);
  const [gateDialogOpen, setGateDialogOpen] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState<TransitionInfo | null>(null);

  // Fetch available transitions
  const loadTransitions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/crm/check-transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId }),
      });

      if (response.ok) {
        const data = await response.json();
        const available = (data.availableTransitions || []).map((t: AvailableTransition) => ({
          ...t,
          canTransition: true,
        }));
        setTransitions(available);
      }
    } catch (err) {
      console.error('Error loading transitions:', err);
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    loadTransitions();
  }, [loadTransitions]);

  const handleTransitionSelect = async (transition: TransitionInfo) => {
    // Check if transition has requirements
    if (transition.required_fields.length > 0 || transition.requires_approval || transition.require_reason) {
      setSelectedTransition(transition);
      setGateDialogOpen(true);
      return;
    }

    // Try direct transition
    try {
      const response = await fetch('/api/crm/stage-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          newStage: transition.to,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Needs gating dialog
        if (result.gatingRequired || result.missingFields || result.validationErrors) {
          setSelectedTransition(transition);
          setGateDialogOpen(true);
          return;
        }
        throw new Error(result.error || 'Transition failed');
      }

      // Success - refresh
      onStageChange?.(transition.to);
      router.refresh();
    } catch (err) {
      console.error('Error changing stage:', err);
      // Open dialog for retry with fields
      setSelectedTransition(transition);
      setGateDialogOpen(true);
    }
  };

  const handleGateComplete = (result: { success: boolean; record?: unknown }) => {
    if (result.success) {
      onStageChange?.(selectedTransition?.to || '');
      router.refresh();
    }
    setGateDialogOpen(false);
    setSelectedTransition(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled || loading}
            className={cn(
              "glass border-white/10 text-white hover:bg-white/5 gap-2",
              className
            )}
            style={{
              borderColor: currentStageColor ? `${currentStageColor}50` : undefined,
            }}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: currentStageColor || '#6366f1' }}
                />
                <span>{currentStageLabel || currentStage || 'No Stage'}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          className="w-64 glass-card border-white/10"
        >
          {transitions.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-slate-400">
              No transitions available
            </div>
          ) : (
            <>
              <div className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Move to stage
              </div>
              <DropdownMenuSeparator className="bg-white/10" />
              {transitions.map((transition) => (
                <DropdownMenuItem
                  key={transition.to}
                  onClick={() => handleTransitionSelect(transition)}
                  disabled={!transition.canTransition}
                  className={cn(
                    "flex items-center justify-between py-2.5 cursor-pointer",
                    "text-slate-300 focus:text-white focus:bg-white/10",
                    !transition.canTransition && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: transition.toColor || '#6366f1' }}
                    />
                    <span>{transition.toLabel}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {transition.required_fields.length > 0 && (
                      <Badge 
                        variant="outline" 
                        className="text-[10px] px-1.5 py-0 h-5 border-amber-500/50 text-amber-400"
                      >
                        {transition.required_fields.length} req
                      </Badge>
                    )}
                    {transition.requires_approval && (
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    {!transition.canTransition && (
                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    )}
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Transition Gate Dialog */}
      {selectedTransition && (
        <TransitionGateDialog
          open={gateDialogOpen}
          onOpenChange={setGateDialogOpen}
          recordId={recordId}
          currentStage={currentStage}
          currentStageLabel={currentStageLabel}
          targetStage={selectedTransition.to}
          targetStageLabel={selectedTransition.toLabel}
          targetStageColor={selectedTransition.toColor}
          onComplete={handleGateComplete}
        />
      )}
    </>
  );
}
