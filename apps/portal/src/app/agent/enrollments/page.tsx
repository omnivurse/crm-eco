'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { 
  FileText, 
  Search, 
  Filter,
  Eye,
  Calendar,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';

interface Enrollment {
  id: string;
  status: string;
  plan_type: string | null;
  monthly_cost: number | null;
  start_date: string | null;
  enrollment_date: string | null;
  created_at: string;
  members: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
  plans: {
    name: string;
  } | null;
}

export default function AgentEnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [filteredEnrollments, setFilteredEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  
  const supabase = createClient();

  useEffect(() => {
    fetchEnrollments();
  }, []);

  useEffect(() => {
    filterEnrollments();
  }, [searchTerm, statusFilter, enrollments]);

  const fetchEnrollments = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get profile first
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single() as { data: { id: string } | null };

    if (!profile) return;

    // Get advisor using profile_id
    const { data: advisor } = await supabase
      .from('advisors')
      .select('id, organization_id')
      .eq('profile_id', profile.id)
      .single() as { data: { id: string; organization_id: string } | null };

    if (!advisor) return;

    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        plan_type,
        monthly_cost,
        start_date,
        enrollment_date,
        created_at,
        members (
          id,
          first_name,
          last_name,
          email
        ),
        plans (
          name
        )
      `)
      .eq('advisor_id', advisor.id)
      .eq('organization_id', advisor.organization_id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setEnrollments(data as unknown as Enrollment[]);
    }
    setLoading(false);
  };

  const filterEnrollments = () => {
    let filtered = enrollments;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.members?.first_name.toLowerCase().includes(search) ||
        e.members?.last_name.toLowerCase().includes(search) ||
        e.members?.email?.toLowerCase().includes(search) ||
        e.plans?.name.toLowerCase().includes(search)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === statusFilter);
    }

    setFilteredEnrollments(filtered);
    setPage(1);
  };

  const paginatedEnrollments = filteredEnrollments.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const totalPages = Math.ceil(filteredEnrollments.length / itemsPerPage);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'Active': 'bg-green-100 text-green-700',
      'active': 'bg-green-100 text-green-700',
      'Pending': 'bg-amber-100 text-amber-700',
      'pending': 'bg-amber-100 text-amber-700',
      'Future Active': 'bg-blue-100 text-blue-700',
      'Inactive': 'bg-slate-100 text-slate-700',
      'inactive': 'bg-slate-100 text-slate-700',
      'Cancelled': 'bg-red-100 text-red-700',
      'cancelled': 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-700'}`}>
        {status}
      </span>
    );
  };

  // Calculate stats
  const stats = {
    total: enrollments.length,
    active: enrollments.filter(e => e.status?.toLowerCase() === 'active').length,
    pending: enrollments.filter(e => e.status?.toLowerCase() === 'pending').length,
    monthlyRevenue: enrollments
      .filter(e => e.status?.toLowerCase() === 'active')
      .reduce((sum, e) => sum + (e.monthly_cost || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FileText className="h-12 w-12 animate-pulse text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Enrollments</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Enrollments</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <FileText className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <FileText className="h-4 w-4 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Monthly Revenue</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${stats.monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by member or plan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Future Active">Future Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {paginatedEnrollments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No enrollments found</h3>
              <p className="text-slate-500">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Start sharing your enrollment link to get enrollments!'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium text-slate-600">Member</th>
                      <th className="pb-3 font-medium text-slate-600">Plan</th>
                      <th className="pb-3 font-medium text-slate-600">Type</th>
                      <th className="pb-3 font-medium text-slate-600">Monthly</th>
                      <th className="pb-3 font-medium text-slate-600">Status</th>
                      <th className="pb-3 font-medium text-slate-600">Start Date</th>
                      <th className="pb-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedEnrollments.map((enrollment) => (
                      <tr key={enrollment.id} className="hover:bg-slate-50">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                              {enrollment.members?.first_name?.charAt(0) || '?'}
                              {enrollment.members?.last_name?.charAt(0) || ''}
                            </div>
                            <div>
                              <Link 
                                href={`/agent/members/${enrollment.members?.id}`}
                                className="font-medium text-slate-900 hover:text-blue-600"
                              >
                                {enrollment.members?.first_name} {enrollment.members?.last_name}
                              </Link>
                              <p className="text-sm text-slate-500">{enrollment.members?.email || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-slate-900">
                          {enrollment.plans?.name || '-'}
                        </td>
                        <td className="py-4 text-sm text-slate-600">
                          {enrollment.plan_type || '-'}
                        </td>
                        <td className="py-4 font-medium text-slate-900">
                          {enrollment.monthly_cost 
                            ? `$${enrollment.monthly_cost.toFixed(2)}`
                            : '-'}
                        </td>
                        <td className="py-4">
                          {getStatusBadge(enrollment.status)}
                        </td>
                        <td className="py-4 text-sm text-slate-600">
                          {enrollment.start_date
                            ? new Date(enrollment.start_date).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="py-4">
                          <Link href={`/agent/enrollments/${enrollment.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <p className="text-sm text-slate-500">
                    Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filteredEnrollments.length)} of {filteredEnrollments.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-slate-600">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
