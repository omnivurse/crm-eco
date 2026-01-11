/**
 * CRM Approvals Library
 * Multi-step approval processes
 */

// Types
export * from './types';

// Engine
export {
  getApprovalProcess,
  getApproval,
  getPendingApprovalsForUser,
  getApprovalHistory,
  validateApprover,
  executeApprovalAction,
  getRecordPendingApproval,
  cancelApproval,
} from './engine';
