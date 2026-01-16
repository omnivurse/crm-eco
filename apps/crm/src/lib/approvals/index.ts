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
  // W4 additions
  createApprovalRequest,
  applyApprovedAction,
  getApprovalInbox,
  getApprovalDetail,
  getApprovalDecisions,
  recordApprovalDecision,
  getApprovalProcesses,
  createApprovalProcessRecord,
  updateApprovalProcessRecord,
  deleteApprovalProcess,
} from './engine';

// Rules Engine
export {
  getApprovalRulesForModule,
  getApprovalRule,
  evaluateApprovalRules,
  checkApprovalRequired,
  createApprovalRule,
  updateApprovalRule,
  deleteApprovalRule,
} from './rules';
