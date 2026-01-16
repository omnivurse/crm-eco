'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { PipelineBoard } from '@/components/crm/pipeline';
import { TransitionGateDialog } from '@/components/crm/blueprints';
import type { CrmRecord, CrmDealStage } from '@/lib/crm/types';

interface PipelineClientProps {
  deals: CrmRecord[];
  stages: CrmDealStage[];
}

interface PendingTransition {
  dealId: string;
  fromStage: string;
  toStage: string;
  toStageLabel: string;
  toStageColor?: string;
  fromStageLabel?: string;
}

export function PipelineClient({ deals, stages }: PipelineClientProps) {
  const router = useRouter();
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const [gateDialogOpen, setGateDialogOpen] = useState(false);

  const getStageInfo = useCallback((stageKey: string) => {
    const stage = stages.find(s => s.key === stageKey);
    return {
      label: stage?.name || stageKey,
      color: stage?.color,
    };
  }, [stages]);

  const handleStageChange = useCallback(async (
    dealId: string, 
    newStage: string, 
    oldStage: string
  ): Promise<void> => {
    try {
      const response = await fetch('/api/crm/stage-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: dealId,
          newStage,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Check if gating is required
        if (result.gatingRequired || result.missingFields || result.validationErrors || result.requiresApproval) {
          // Open the gating dialog
          const toStageInfo = getStageInfo(newStage);
          const fromStageInfo = getStageInfo(oldStage);
          
          setPendingTransition({
            dealId,
            fromStage: oldStage,
            toStage: newStage,
            toStageLabel: toStageInfo.label,
            toStageColor: toStageInfo.color,
            fromStageLabel: fromStageInfo.label,
          });
          setGateDialogOpen(true);
          
          // Throw to trigger revert in PipelineBoard
          throw new Error('Gating required');
        }
        
        throw new Error(result.error || 'Failed to update stage');
      }

      // Refresh the page to get updated data
      router.refresh();
    } catch (error) {
      console.error('Stage change failed:', error);
      throw error; // Re-throw to let PipelineBoard handle the revert
    }
  }, [router, getStageInfo]);

  const handleGateComplete = useCallback((result: { success: boolean }) => {
    if (result.success) {
      router.refresh();
    }
    setGateDialogOpen(false);
    setPendingTransition(null);
  }, [router]);

  const handleGateDialogChange = useCallback((open: boolean) => {
    setGateDialogOpen(open);
    if (!open) {
      setPendingTransition(null);
    }
  }, []);

  return (
    <>
      <PipelineBoard
        deals={deals}
        stages={stages}
        onStageChange={handleStageChange}
      />

      {/* Transition Gate Dialog */}
      {pendingTransition && (
        <TransitionGateDialog
          open={gateDialogOpen}
          onOpenChange={handleGateDialogChange}
          recordId={pendingTransition.dealId}
          currentStage={pendingTransition.fromStage}
          currentStageLabel={pendingTransition.fromStageLabel}
          targetStage={pendingTransition.toStage}
          targetStageLabel={pendingTransition.toStageLabel}
          targetStageColor={pendingTransition.toStageColor}
          onComplete={handleGateComplete}
        />
      )}
    </>
  );
}
