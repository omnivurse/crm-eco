'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { 
  Users, 
  Search, 
  Filter,
  MoreHorizontal,
  Eye,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone_number: string | null;
  enrollment_status: string;
  date_of_birth: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
}

export default function AgentMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  
  const supabase = createClient();

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    filterMembers();
  }, [searchTerm, statusFilter, members]);

  const fetchMembers = async () => {
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

    // Get agent ID using profile_id
    const { data: advisor } = await supabase
      .from('advisors')
      .select('id, organization_id')
      .eq('profile_id', profile.id)
      .single() as { data: { id: string; organization_id: string } | null };

    if (!advisor) return;

    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('advisor_id', advisor.id)
      .eq('organization_id', advisor.organization_id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMembers(data);
    }
    setLoading(false);
  };

  const filterMembers = () => {
    let filtered = members;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.first_name.toLowerCase().includes(search) ||
        m.last_name.toLowerCase().includes(search) ||
        m.email?.toLowerCase().includes(search) ||
        m.id.includes(search)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => m.enrollment_status === statusFilter);
    }

    setFilteredMembers(filtered);
    setPage(1);
  };

  const paginatedMembers = filteredMembers.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      pending: 'secondary',
      inactive: 'outline',
      cancelled: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    );
  };

  const calculateAge = (dob: string | null) => {
    if (!dob) return '-';
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Users className="h-12 w-12 animate-pulse text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Members</h1>
        <div className="text-sm text-slate-500">
          {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, email, or ID..."
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {paginatedMembers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No members found</h3>
              <p className="text-slate-500">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Share your enrollment link to start getting members!'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium text-slate-600">Member</th>
                      <th className="pb-3 font-medium text-slate-600">Contact</th>
                      <th className="pb-3 font-medium text-slate-600">Location</th>
                      <th className="pb-3 font-medium text-slate-600">Age</th>
                      <th className="pb-3 font-medium text-slate-600">Status</th>
                      <th className="pb-3 font-medium text-slate-600">Joined</th>
                      <th className="pb-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-slate-50">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                              {member.first_name.charAt(0)}{member.last_name.charAt(0)}
                            </div>
                            <div>
                              <Link 
                                href={`/agent/members/${member.id}`}
                                className="font-medium text-slate-900 hover:text-blue-600"
                              >
                                {member.first_name} {member.last_name}
                              </Link>
                              <p className="text-sm text-slate-500">ID: {member.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="space-y-1">
                            {member.email && (
                              <div className="flex items-center gap-1 text-sm text-slate-600">
                                <Mail className="h-3 w-3" />
                                {member.email}
                              </div>
                            )}
                            {member.phone_number && (
                              <div className="flex items-center gap-1 text-sm text-slate-600">
                                <Phone className="h-3 w-3" />
                                {member.phone_number}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 text-sm text-slate-600">
                          {member.city && member.state 
                            ? `${member.city}, ${member.state}`
                            : '-'}
                        </td>
                        <td className="py-4 text-sm text-slate-600">
                          {calculateAge(member.date_of_birth)}
                        </td>
                        <td className="py-4">
                          {getStatusBadge(member.enrollment_status)}
                        </td>
                        <td className="py-4 text-sm text-slate-500">
                          {new Date(member.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <Link href={`/agent/members/${member.id}`}>
                                <DropdownMenuItem>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                              </Link>
                              {member.email && (
                                <DropdownMenuItem onClick={() => window.location.href = `mailto:${member.email}`}>
                                  <Mail className="mr-2 h-4 w-4" />
                                  Send Email
                                </DropdownMenuItem>
                              )}
                              {member.phone_number && (
                                <DropdownMenuItem onClick={() => window.location.href = `tel:${member.phone_number}`}>
                                  <Phone className="mr-2 h-4 w-4" />
                                  Call
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <p className="text-sm text-slate-500">
                    Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filteredMembers.length)} of {filteredMembers.length}
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
