'use client';

import { useState } from 'react';
import { Button } from '@crm-eco/ui';
import { RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { rollbackImport } from './actions';
import { useRouter } from 'next/navigation';

interface RollbackButtonProps {
  importJobId: string;
  snapshotCount: number;
}

export function RollbackButton({ importJobId, snapshotCount }: RollbackButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  const handleRollback = async () => {
    setIsRollingBack(true);
    setError(null);
    
    try {
      const result = await rollbackImport(importJobId);
      
      if (result.error) {
        setError(result.error);
      } else {
        // Refresh the page to show updated status
        router.refresh();
        setIsConfirming(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setIsRollingBack(false);
    }
  };
  
  if (isConfirming) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg max-w-md">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">Confirm Rollback</p>
            <p className="text-amber-700 mt-1">
              This will revert {snapshotCount} change{snapshotCount !== 1 ? 's' : ''}. 
              Inserted records will be deleted and updated records will be restored.
            </p>
          </div>
        </div>
        
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsConfirming(false)}
            disabled={isRollingBack}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleRollback}
            disabled={isRollingBack}
            className="gap-2"
          >
            {isRollingBack ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rolling Back...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                Confirm Rollback
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => setIsConfirming(true)}
      className="gap-2 text-amber-700 border-amber-300 hover:bg-amber-50"
    >
      <RotateCcw className="w-4 h-4" />
      Rollback Import
    </Button>
  );
}
