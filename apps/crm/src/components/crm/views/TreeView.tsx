'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  ChevronRight,
  ChevronDown,
  Users,
  User,
  Building2,
  ZoomIn,
  ZoomOut,
  Inbox,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import type { CrmRecord, CrmField, AdvisorTreeNode, TreeGroupBy } from '@/lib/crm/types';
import type { AdvisorTreeData, AgentTreeData } from '@/lib/crm/queries';

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                    */
/* ------------------------------------------------------------------ */

interface TreeViewProps {
  records: CrmRecord[];
  fields: CrmField[];
  moduleKey: string;
  /** Mirrors `?search=` from the module page (toolbar). Single source of truth. */
  moduleSearch?: string;
  advisorTreeData?: AdvisorTreeData | null;
  agentTreeData?: AgentTreeData | null;
  treeGroupBy?: TreeGroupBy;
  onRowClick?: (recordId: string) => void;
}

type SortKey = 'name' | 'tier' | 'count';

/** Dedupe CRM records by id (same row must not render twice under an agent group). */
function mergeRecordListsById(a: CrmRecord[], b: CrmRecord[]): CrmRecord[] {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const seen = new Set(a.map((r) => r.id));
  const out = [...a];
  for (const r of b) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      out.push(r);
    }
  }
  return out;
}

/** Build a tree from the flat advisor list + record counts map */
function buildAdvisorTree(
  advisors: AdvisorTreeData['advisors'],
  recordCounts: Record<string, number>,
): AdvisorTreeNode[] {
  const seenAdvisorIds = new Set<string>();
  const uniqueAdvisors = advisors.filter((a) => {
    if (seenAdvisorIds.has(a.id)) return false;
    seenAdvisorIds.add(a.id);
    return true;
  });

  const map = new Map<string, AdvisorTreeNode>();
  const roots: AdvisorTreeNode[] = [];

  for (const a of uniqueAdvisors) {
    map.set(a.id, { ...a, children: [], recordCount: recordCounts[a.id] || 0 });
  }

  for (const a of uniqueAdvisors) {
    const node = map.get(a.id)!;
    if (a.parent_advisor_id && map.has(a.parent_advisor_id)) {
      const parent = map.get(a.parent_advisor_id)!;
      if (!parent.children.some((c) => c.id === a.id)) {
        parent.children.push(node);
      }
    } else if (!roots.some((r) => r.id === a.id)) {
      roots.push(node);
    }
  }

  return roots;
}

/** Total records in a subtree (node + all descendants) */
function getSubtreeCount(node: AdvisorTreeNode): number {
  return node.recordCount + node.children.reduce((s, c) => s + getSubtreeCount(c), 0);
}

/** Sort tree nodes recursively */
function sortNodes(nodes: AdvisorTreeNode[], key: SortKey): AdvisorTreeNode[] {
  const sorted = [...nodes];
  switch (key) {
    case 'name':
      sorted.sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
      );
      break;
    case 'tier':
      sorted.sort((a, b) =>
        (a.commission_tier || 'zzz').localeCompare(b.commission_tier || 'zzz'),
      );
      break;
    case 'count':
      sorted.sort((a, b) => getSubtreeCount(b) - getSubtreeCount(a));
      break;
  }
  return sorted.map(n => ({ ...n, children: sortNodes(n.children, key) }));
}

/**
 * When `query` is set, `records` are already narrowed by the server (`getRecords` + module toolbar).
 * Keep a branch if the advisor matches text or any visible row is assigned to this advisor (or a descendant matches).
 */
function filterTree(nodes: AdvisorTreeNode[], query: string, records: CrmRecord[]): AdvisorTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return nodes.reduce<AdvisorTreeNode[]>((acc, node) => {
    const advisorMatch =
      `${node.first_name} ${node.last_name}`.toLowerCase().includes(q) ||
      (node.email || '').toLowerCase().includes(q) ||
      (node.agency_name || '').toLowerCase().includes(q) ||
      (node.producer_code || '').toLowerCase().includes(q);
    const contactMatch = records.some((r) => r.canonical_advisor_id === node.id);
    const filteredChildren = filterTree(node.children, query, records);
    if (advisorMatch || contactMatch || filteredChildren.length > 0) {
      acc.push({ ...node, children: filteredChildren });
    }
    return acc;
  }, []);
}

/** Collect IDs of all nodes that have children (for Expand All) */
function collectParentIds(nodes: AdvisorTreeNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children.length > 0) {
      ids.push(node.id);
      ids.push(...collectParentIds(node.children));
    }
  }
  return ids;
}

/* ------------------------------------------------------------------ */
/*  Advisor tree node                                                  */
/* ------------------------------------------------------------------ */

function AdvisorNode({
  node,
  level,
  expandedIds,
  onToggle,
}: {
  node: AdvisorTreeNode;
  level: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const subtreeCount = getSubtreeCount(node);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-2 px-3 rounded-lg transition-colors',
          'hover:bg-slate-50 dark:hover:bg-white/[0.03]',
          hasChildren ? 'cursor-pointer' : 'cursor-default',
        )}
        style={{ paddingLeft: `${12 + level * 24}px` }}
        onClick={() => hasChildren && onToggle(node.id)}
      >
        {/* Expand / collapse chevron */}
        <button
          className={cn(
            'p-0.5 rounded',
            hasChildren
              ? 'hover:bg-slate-200 dark:hover:bg-white/10'
              : 'opacity-0 pointer-events-none',
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {/* Avatar */}
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0',
            node.status === 'active' ? 'bg-teal-500' : 'bg-slate-400',
          )}
        >
          {(node.first_name?.[0] || '').toUpperCase()}
          {(node.last_name?.[0] || '').toUpperCase()}
        </div>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-slate-900 dark:text-white truncate">
              {node.first_name} {node.last_name}
            </span>
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border',
                node.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
              )}
            >
              {node.status}
            </span>
            {node.commission_tier && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30">
                {node.commission_tier}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            {node.email && (
              <span className="truncate max-w-[200px]">{node.email}</span>
            )}
            {hasChildren && (
              <span className="flex items-center gap-1 flex-shrink-0">
                <Users className="w-3 h-3" />
                {node.children.length} downline
              </span>
            )}
          </div>
        </div>

        {/* Record count badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {node.recordCount > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/30">
              {node.recordCount} contact{node.recordCount !== 1 ? 's' : ''}
            </span>
          )}
          {hasChildren && subtreeCount > node.recordCount && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              ({subtreeCount} total contacts)
            </span>
          )}
        </div>
      </div>

      {/* Child nodes */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <AdvisorNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Agent hierarchy types & helpers                                    */
/* ------------------------------------------------------------------ */

interface AgentSubGroup {
  name: string;
  recordCount: number;
  records: CrmRecord[];
}

interface AgentHierarchyItem {
  /** Base agent name (before " - ") */
  name: string;
  /** Records directly under this agent (no sub-group qualifier) */
  directCount: number;
  directRecords: CrmRecord[];
  /** Sub-groups (agencies, organizations) under this agent */
  subGroups: AgentSubGroup[];
  /** Total across direct + all sub-groups */
  totalCount: number;
}

/**
 * Parse flat agent list into a 2-level hierarchy.
 * Agent names like "Cindy Gordon - Momentum Title Agency"
 * become parent="Cindy Gordon" → child="Momentum Title Agency"
 */
function buildAgentHierarchy(
  agents: Array<{ name: string; recordCount: number }>,
  recordsByAgent: Map<string, CrmRecord[]>,
): AgentHierarchyItem[] {
  const parentMap = new Map<string, AgentHierarchyItem>();

  for (const agent of agents) {
    const dashIdx = agent.name.indexOf(' - ');
    const parentName = dashIdx > 0 ? agent.name.slice(0, dashIdx).trim() : agent.name;
    const subGroupName = dashIdx > 0 ? agent.name.slice(dashIdx + 3).trim() : null;

    if (!parentMap.has(parentName)) {
      parentMap.set(parentName, {
        name: parentName,
        directCount: 0,
        directRecords: [],
        subGroups: [],
        totalCount: 0,
      });
    }

    const parent = parentMap.get(parentName)!;
    const recs = recordsByAgent.get(agent.name) || [];

    if (subGroupName) {
      const existingSg = parent.subGroups.find((sg) => sg.name === subGroupName);
      if (existingSg) {
        existingSg.recordCount += agent.recordCount;
        existingSg.records = mergeRecordListsById(existingSg.records, recs);
      } else {
        parent.subGroups.push({
          name: subGroupName,
          recordCount: agent.recordCount,
          records: [...recs],
        });
      }
    } else {
      parent.directCount += agent.recordCount;
      parent.directRecords = mergeRecordListsById(parent.directRecords, recs);
    }
    parent.totalCount += agent.recordCount;
  }

  return Array.from(parentMap.values());
}

/** Collect all expandable IDs from agent hierarchy (for Expand All) */
function collectAgentParentIds(items: AgentHierarchyItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.subGroups.length > 0) {
      ids.push(item.name);
      // Sub-groups are leaf level, but add them too for record expansion
      for (const sg of item.subGroups) {
        ids.push(`${item.name}::${sg.name}`);
      }
    }
    // Also add the parent if it has direct records (for expanding direct records section)
    if (item.directCount > 0 || item.subGroups.length > 0) {
      ids.push(item.name);
    }
  }
  return ids;
}

/* ------------------------------------------------------------------ */
/*  Agent hierarchy node (nested tree)                                 */
/* ------------------------------------------------------------------ */

function AgentHierarchyNode({
  item,
  expandedIds,
  onToggle,
  onRowClick,
}: {
  item: AgentHierarchyItem;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onRowClick?: (id: string) => void;
}) {
  const isExpanded = expandedIds.has(item.name);
  const hasChildren = item.subGroups.length > 0;
  const initials =
    item.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';

  return (
    <div className="border-b border-slate-100 dark:border-white/5 last:border-0">
      {/* Parent agent row */}
      <button
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
        onClick={() => onToggle(item.name)}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
        )}
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm text-slate-900 dark:text-white truncate block">
            {item.name || 'Unassigned'}
          </span>
          {hasChildren && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {item.subGroups.length} group{item.subGroups.length !== 1 ? 's' : ''}
              {item.directCount > 0 && ` + ${item.directCount.toLocaleString()} direct`}
            </span>
          )}
        </div>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30 flex-shrink-0">
          {item.totalCount.toLocaleString()} contact{item.totalCount !== 1 ? 's' : ''}
        </span>
      </button>

      {/* Expanded: show sub-groups and/or direct records */}
      {isExpanded && (
        <div className="pl-6">
          {/* Direct records (agent without sub-group) */}
          {item.directCount > 0 && !hasChildren && (
            <AgentRecordList
              records={item.directRecords}
              totalCount={item.directCount}
              onRowClick={onRowClick}
              indent={6}
            />
          )}

          {/* When there are sub-groups, show direct records as a sub-group too */}
          {item.directCount > 0 && hasChildren && (
            <AgentSubGroupNode
              parentName={item.name}
              subGroupName="Direct Records"
              recordCount={item.directCount}
              records={item.directRecords}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onRowClick={onRowClick}
              icon="user"
            />
          )}

          {/* Sub-groups (agencies/organizations) */}
          {item.subGroups.map((sg) => (
            <AgentSubGroupNode
              key={sg.name}
              parentName={item.name}
              subGroupName={sg.name}
              recordCount={sg.recordCount}
              records={sg.records}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onRowClick={onRowClick}
              icon="building"
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* Sub-group node (level 2 in agent hierarchy) */
function AgentSubGroupNode({
  parentName,
  subGroupName,
  recordCount,
  records,
  expandedIds,
  onToggle,
  onRowClick,
  icon,
}: {
  parentName: string;
  subGroupName: string;
  recordCount: number;
  records: CrmRecord[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onRowClick?: (id: string) => void;
  icon: 'building' | 'user';
}) {
  const nodeId = `${parentName}::${subGroupName}`;
  const isExpanded = expandedIds.has(nodeId);

  return (
    <div className="border-b border-slate-50 dark:border-white/[0.03] last:border-0">
      <button
        className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
        onClick={() => onToggle(nodeId)}
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        )}
        {icon === 'building' ? (
          <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
        <span className="text-sm text-slate-700 dark:text-slate-200 font-medium flex-1 truncate">
          {subGroupName}
        </span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 flex-shrink-0">
          {recordCount.toLocaleString()} contact{recordCount !== 1 ? 's' : ''}
        </span>
      </button>

      {isExpanded && (
        <AgentRecordList
          records={records}
          totalCount={recordCount}
          onRowClick={onRowClick}
          indent={10}
        />
      )}
    </div>
  );
}

/* Record list for agent tree (shared by direct & sub-group) */
function AgentRecordList({
  records,
  totalCount,
  onRowClick,
  indent,
}: {
  records: CrmRecord[];
  totalCount: number;
  onRowClick?: (id: string) => void;
  indent: number;
}) {
  if (records.length === 0) {
    return (
      <div className="px-3 py-3 text-xs text-slate-400 dark:text-slate-500 italic" style={{ paddingLeft: `${indent * 4}px` }}>
        {totalCount} record{totalCount !== 1 ? 's' : ''} &mdash; switch to list view to browse
      </div>
    );
  }

  return (
    <div className="pb-2" style={{ paddingLeft: `${indent * 4}px` }}>
      {records.map((record) => {
        const name =
          record.title ||
          [record.data?.first_name, record.data?.last_name]
            .filter(Boolean)
            .join(' ') ||
          'Untitled';
        const email = (record.email || record.data?.email) as string | undefined;
        const status = String(
          record.status || record.data?.status || record.data?.lead_status || '',
        );

        return (
          <div
            key={record.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
            onClick={() => onRowClick?.(record.id)}
          >
            <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-900 dark:text-white font-medium truncate flex-1">
              {name}
            </span>
            {status && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                {status}
              </span>
            )}
            {email && (
              <span className="hidden md:block text-xs text-slate-400 truncate max-w-[150px]">
                {email}
              </span>
            )}
          </div>
        );
      })}
      {records.length < totalCount && (
        <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
          Showing {records.length} of {totalCount} records
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main TreeView                                                      */
/* ------------------------------------------------------------------ */

export const TreeView = memo(function TreeView({
  records,
  fields: _fields,
  moduleKey: _moduleKey,
  moduleSearch = '',
  advisorTreeData,
  agentTreeData,
  treeGroupBy = 'advisor',
  onRowClick,
}: TreeViewProps) {
  const router = useRouter();
  const searchQ = moduleSearch.trim();
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleRowClick = useCallback(
    (id: string) => {
      if (onRowClick) onRowClick(id);
      else router.push(`/crm/r/${id}`);
    },
    [onRowClick, router],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* Advisor tree --------------------------------------------------- */

  const advisorTree = useMemo(() => {
    if (treeGroupBy !== 'advisor' || !advisorTreeData) return [];
    const tree = buildAdvisorTree(advisorTreeData.advisors, advisorTreeData.recordCounts);
    const filtered = filterTree(tree, searchQ, records);
    return sortNodes(filtered, sortBy);
  }, [advisorTreeData, treeGroupBy, searchQ, sortBy, records]);

  /* Agent hierarchy ------------------------------------------------- */

  const agentHierarchy = useMemo((): AgentHierarchyItem[] => {
    if (treeGroupBy !== 'agent') return [];

    // Build record map from paginated records
    const recordsByAgent = new Map<string, CrmRecord[]>();
    for (const r of records) {
      const agent =
        String(r.data?.agent || r.data?.producer_name || '').trim() || 'Unassigned';
      if (!recordsByAgent.has(agent)) recordsByAgent.set(agent, []);
      recordsByAgent.get(agent)!.push(r);
    }

    // Build the flat agent list (prefer server data)
    let flatAgents: Array<{ name: string; recordCount: number }>;
    if (agentTreeData) {
      flatAgents = agentTreeData.agents;
    } else {
      flatAgents = Array.from(recordsByAgent.entries()).map(([name, recs]) => ({
        name,
        recordCount: recs.length,
      }));
    }

    // Parse into hierarchy
    let items = buildAgentHierarchy(flatAgents, recordsByAgent);

    // Sort
    if (sortBy === 'count') {
      items.sort((a, b) => b.totalCount - a.totalCount);
      items.forEach((it) => it.subGroups.sort((a, b) => b.recordCount - a.recordCount));
    } else {
      items.sort((a, b) => a.name.localeCompare(b.name));
      items.forEach((it) => it.subGroups.sort((a, b) => a.name.localeCompare(b.name)));
    }

    // With module search active, `records` are server-filtered — keep branches with visible rows or name matches.
    if (searchQ) {
      const ql = searchQ.toLowerCase();
      items = items.filter((it) => {
        const structureMatch =
          it.name.toLowerCase().includes(ql) ||
          it.subGroups.some((sg) => sg.name.toLowerCase().includes(ql));
        if (structureMatch) return true;
        return (
          it.directRecords.length > 0 ||
          it.subGroups.some((sg) => sg.records.length > 0)
        );
      });
    }

    return items;
  }, [records, agentTreeData, treeGroupBy, searchQ, sortBy]);

  /* Expand / Collapse ---------------------------------------------- */

  const expandAll = useCallback(() => {
    if (treeGroupBy === 'advisor') {
      setExpandedIds(new Set(collectParentIds(advisorTree)));
    } else {
      setExpandedIds(new Set(collectAgentParentIds(agentHierarchy)));
    }
  }, [treeGroupBy, advisorTree, agentHierarchy]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  /* Stats ---------------------------------------------------------- */

  const totalAdvisors = advisorTreeData?.advisors.length || 0;
  const totalTreeRecords = useMemo(() => {
    if (!advisorTreeData) return 0;
    return Object.values(advisorTreeData.recordCounts).reduce((a, b) => a + b, 0);
  }, [advisorTreeData]);

  const totalAgentRecords = agentTreeData?.totalRecords || records.length;

  /* ---------------------------------------------------------------- */

  return (
    <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
      {/* Toolbar — module search lives in ModuleShell above (URL `search`). */}
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {searchQ ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 dark:border-teal-500/30 bg-teal-50/80 dark:bg-teal-500/10 px-2 py-1 text-teal-800 dark:text-teal-300">
                <Filter className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium truncate max-w-[min(28rem,70vw)]" title={searchQ}>
                  Module search: {searchQ}
                </span>
              </span>
            ) : null}
            <span className="whitespace-nowrap">
              {searchQ
                ? treeGroupBy === 'advisor'
                  ? `${advisorTree.length} root branch${advisorTree.length !== 1 ? 'es' : ''} · ${records.length} matching record${records.length !== 1 ? 's' : ''} on this page`
                  : `${agentHierarchy.length} group${agentHierarchy.length !== 1 ? 's' : ''} · ${records.length} matching record${records.length !== 1 ? 's' : ''} on this page`
                : treeGroupBy === 'advisor'
                  ? `${totalAdvisors} advisor${totalAdvisors !== 1 ? 's' : ''} \u00B7 ${totalTreeRecords.toLocaleString()} contact${totalTreeRecords !== 1 ? 's' : ''} assigned`
                  : `${agentHierarchy.length} advisor${agentHierarchy.length !== 1 ? 's' : ''} \u00B7 ${totalAgentRecords.toLocaleString()} contact${totalAgentRecords !== 1 ? 's' : ''} assigned`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Sort */}
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-slate-600 dark:text-slate-300"
              >
                <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
            >
              <DropdownMenuItem
                onClick={() => setSortBy('name')}
                className={cn('cursor-pointer', sortBy === 'name' && 'font-semibold')}
              >
                By Name
              </DropdownMenuItem>
              {treeGroupBy === 'advisor' && (
                <DropdownMenuItem
                  onClick={() => setSortBy('tier')}
                  className={cn('cursor-pointer', sortBy === 'tier' && 'font-semibold')}
                >
                  By Tier
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => setSortBy('count')}
                className={cn('cursor-pointer', sortBy === 'count' && 'font-semibold')}
              >
                By Record Count
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-5 bg-slate-200 dark:bg-white/10" />

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={expandAll}
          >
            <ZoomIn className="w-3.5 h-3.5 mr-1" />
            Expand
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={collapseAll}
          >
            <ZoomOut className="w-3.5 h-3.5 mr-1" />
            Collapse
          </Button>
        </div>
        </div>
      </div>

      {/* Tree content */}
      <div className="max-h-[calc(100vh-var(--crm-view-offset)-100px)] overflow-auto scrollbar-thin">
        {treeGroupBy === 'advisor' ? (
          advisorTree.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {searchQ
                  ? 'No advisors match this module search. Try different keywords or clear the search above.'
                  : 'No HealthShare advisors found'}
              </p>
              {!searchQ && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
                  Advisors manage HealthShare contacts. Make sure advisor records exist and contacts are assigned.
                </p>
              )}
            </div>
          ) : (
            <div className="py-1">
              {advisorTree.map((node) => (
                <AdvisorNode
                  key={node.id}
                  node={node}
                  level={0}
                  expandedIds={expandedIds}
                  onToggle={toggleExpand}
                />
              ))}
            </div>
          )
        ) : agentHierarchy.length === 0 ? (
          <div className="py-12 text-center">
            <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {searchQ
                ? 'No agent groups match this module search. Try different keywords or clear the search above.'
                : 'No advisors found'}
            </p>
            {!searchQ && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
                Contacts are grouped by their assigned advisor. Use plan type to distinguish HealthShare from Traditional Insurance.
              </p>
            )}
          </div>
        ) : (
          <div>
            {agentHierarchy.map((item) => (
              <AgentHierarchyNode
                key={item.name}
                item={item}
                expandedIds={expandedIds}
                onToggle={toggleExpand}
                onRowClick={handleRowClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
