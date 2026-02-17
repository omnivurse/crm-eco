'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui';
import { Search, Users, ArrowUpDown, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface DownlineAgent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  producer_code: string | null;
  producer_type: string | null;
  advisor_code: string | null;
  created_at: string;
}

interface DownlineSearchProps {
  agents: DownlineAgent[];
  parentAgentId: string;
}

type SortField = 'name' | 'status' | 'producer_type' | 'created_at';
type SortDirection = 'asc' | 'desc';

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'inactive':
    case 'suspended':
    case 'terminated':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function DownlineSearch({ agents, parentAgentId }: DownlineSearchProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const filteredAndSorted = useMemo(() => {
    let result = [...agents];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((a) => {
        const name = `${a.first_name} ${a.last_name}`.toLowerCase();
        const code = (a.producer_code || a.advisor_code || '').toLowerCase();
        const email = a.email.toLowerCase();
        const phone = (a.phone || '').toLowerCase();
        return name.includes(q) || code.includes(q) || email.includes(q) || phone.includes(q);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'producer_type':
          cmp = (a.producer_type || '').localeCompare(b.producer_type || '');
          break;
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [agents, search, statusFilter, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(agents.map((a) => a.status))).sort();
  }, [agents]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Downline Agents
            </CardTitle>
            <CardDescription>
              {agents.length} direct downline agent{agents.length !== 1 ? 's' : ''}
              {filteredAndSorted.length !== agents.length && (
                <span> ({filteredAndSorted.length} shown)</span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name, code, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {uniqueStatuses.map((status) => (
                <SelectItem key={status} value={status} className="capitalize">
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {filteredAndSorted.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {agents.length === 0
              ? 'No downline agents found for this producer.'
              : 'No agents match the current filters.'}
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      onClick={() => toggleSort('name')}
                      className="flex items-center gap-1 hover:text-slate-900"
                    >
                      Name
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>
                    <button
                      onClick={() => toggleSort('producer_type')}
                      className="flex items-center gap-1 hover:text-slate-900"
                    >
                      Type
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => toggleSort('status')}
                      className="flex items-center gap-1 hover:text-slate-900"
                    >
                      Status
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => toggleSort('created_at')}
                      className="flex items-center gap-1 hover:text-slate-900"
                    >
                      Joined
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSorted.map((agent) => (
                  <TableRow key={agent.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">
                      <Link
                        href={`/agents/${agent.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {agent.first_name} {agent.last_name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {agent.producer_code || agent.advisor_code || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {agent.email}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {agent.phone || '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {agent.producer_type || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(agent.status)} className="text-xs">
                        {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {format(new Date(agent.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Link href={`/agents/${agent.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
