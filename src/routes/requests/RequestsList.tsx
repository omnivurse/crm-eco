import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { Search, Filter, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { EmptyState } from '../../components/ui/EmptyState';
import { TicketListSkeleton } from '../../components/ui/SkeletonLoader';

interface Request {
  id: string;
  catalog_item: {
    name: string;
    category: {
      name: string;
    };
  };
  status: string;
  priority: string;
  created_at: string;
  requester: {
    full_name: string;
    email: string;
  };
}

export function RequestsList() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('requests')
        .select(`
          id,
          status,
          priority,
          created_at,
          catalog_item:catalog_items(
            name,
            category:catalog_categories(name)
          ),
          requester:profiles!requests_requester_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      const formattedData = (data || []).map(req => ({
        ...req,
        catalog_item: Array.isArray(req.catalog_item) ? req.catalog_item[0] : req.catalog_item,
        requester: Array.isArray(req.requester) ? req.requester[0] : req.requester
      }));
      setRequests(formattedData as any);
    } catch (error) {
      // Error fetching requests
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter((req) =>
    req.catalog_item?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusIcons: Record<string, React.ElementType> = {
    pending: Clock,
    approved: CheckCircle2,
    rejected: XCircle,
    fulfilled: CheckCircle2,
    cancelled: XCircle,
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    fulfilled: 'bg-primary-100 text-primary-900 dark:bg-primary-950 dark:text-primary-200',
    cancelled: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200',
  };

  if (loading) return <TicketListSkeleton />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="championship-title text-4xl" data-text="Service Requests">Service Requests</h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400 mt-1">
            Track and manage service catalog requests
          </p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={20} />
          <input
            type="text"
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {filteredRequests.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No requests found"
          description="No service requests match your current filters."
        />
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => {
            const StatusIcon = statusIcons[request.status] || AlertCircle;
            return (
              <Link
                key={request.id}
                to={`/requests/${request.id}`}
                className="block glass-card p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">
                      {request.catalog_item?.name || 'Unknown Service'}
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {request.catalog_item?.category?.name || 'Uncategorized'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`modern-badge ${statusColors[request.status]}`}>
                      <StatusIcon size={14} />
                      {request.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                  <span>Requested by {request.requester?.full_name}</span>
                  <span>{format(new Date(request.created_at), 'MMM d, yyyy')}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
