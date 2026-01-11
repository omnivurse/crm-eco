'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button, Badge, cn } from '@crm-eco/ui';
import { ChevronRight, Check, Lock, ArrowRight } from 'lucide-react';
import { TransitionModal } from './TransitionModal';
import type { BlueprintStage, AvailableTransition } from '@/lib/blueprints/types';

interface StageBarProps {
  recordId: string;
  moduleId: string;
  currentStage: string | null;
  onStageChange?: (newStage: string) => void;
}

interface StageInfo extends BlueprintStage {
  isCurrent: boolean;
  isPast: boolean;
  isAvailable: boolean;
}

export function StageBar({ recordId, moduleId, currentStage, onStageChange }: StageBarProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [loading, setLoading] = useState(true);
  const [hasBlueprint, setHasBlueprint] = useState(false);
  const [stages, setStages] = useState<StageInfo[]>([]);
  const [availableTransitions, setAvailableTransitions] = useState<AvailableTransition[]>([]);
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState<AvailableTransition | null>(null);

  // Load blueprint data
  useEffect(() => {
    async function loadBlueprintData() {
      setLoading(true);
      
      try {
        const response = await fetch(`/api/crm/transition?recordId=${recordId}`);
        const data = await response.json();
        
        if (data.hasBlueprint) {
          setHasBlueprint(true);
          
          const currentIndex = data.stages.findIndex((s: BlueprintStage) => s.key === currentStage);
          
          const stageInfos: StageInfo[] = data.stages
            .sort((a: BlueprintStage, b: BlueprintStage) => a.order - b.order)
            .map((stage: BlueprintStage, index: number) => ({
              ...stage,
              isCurrent: stage.key === currentStage,
              isPast: currentIndex >= 0 && index < currentIndex,
              isAvailable: data.availableTransitions.some((t: AvailableTransition) => t.to === stage.key),
            }));
          
          setStages(stageInfos);
          setAvailableTransitions(data.availableTransitions || []);
        } else {
          setHasBlueprint(false);
        }
      } catch (error) {
        console.error('Failed to load blueprint:', error);
        setHasBlueprint(false);
      } finally {
        setLoading(false);
      }
    }
    
    loadBlueprintData();
  }, [recordId, currentStage, supabase]);

  const handleStageClick = (stage: StageInfo) => {
    if (stage.isCurrent) return;
    if (!stage.isAvailable) return;
    
    const transition = availableTransitions.find(t => t.to === stage.key);
    if (transition) {
      setSelectedTransition(transition);
      setTransitionModalOpen(true);
    }
  };

  const handleTransitionComplete = (newStage: string) => {
    setTransitionModalOpen(false);
    setSelectedTransition(null);
    onStageChange?.(newStage);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1 h-10">
        <div className="h-6 w-24 bg-muted animate-pulse rounded" />
        <div className="h-6 w-24 bg-muted animate-pulse rounded" />
        <div className="h-6 w-24 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!hasBlueprint) {
    // No blueprint - show simple stage badge
    return currentStage ? (
      <Badge variant="outline" className="text-sm">
        {currentStage}
      </Badge>
    ) : null;
  }

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {stages.map((stage, index) => (
          <div key={stage.key} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground mx-1 flex-shrink-0" />
            )}
            <button
              onClick={() => handleStageClick(stage)}
              disabled={!stage.isAvailable || stage.isCurrent}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                stage.isCurrent && 'bg-primary text-primary-foreground',
                stage.isPast && !stage.isCurrent && 'bg-muted text-muted-foreground',
                !stage.isPast && !stage.isCurrent && stage.isAvailable && 'bg-muted/50 hover:bg-muted cursor-pointer',
                !stage.isPast && !stage.isCurrent && !stage.isAvailable && 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
              )}
              style={stage.color && stage.isCurrent ? { backgroundColor: stage.color } : undefined}
            >
              {stage.isPast && !stage.isCurrent && (
                <Check className="h-3 w-3" />
              )}
              {!stage.isPast && !stage.isCurrent && !stage.isAvailable && (
                <Lock className="h-3 w-3" />
              )}
              {stage.label}
              {stage.isAvailable && !stage.isCurrent && (
                <ArrowRight className="h-3 w-3 opacity-50" />
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Transition Modal */}
      {selectedTransition && (
        <TransitionModal
          open={transitionModalOpen}
          onOpenChange={setTransitionModalOpen}
          recordId={recordId}
          moduleId={moduleId}
          currentStage={currentStage}
          targetStage={selectedTransition.to}
          targetLabel={selectedTransition.toLabel}
          requiredFields={selectedTransition.required_fields}
          requiresReason={selectedTransition.require_reason}
          requiresApproval={selectedTransition.requires_approval}
          onComplete={handleTransitionComplete}
        />
      )}
    </>
  );
}
