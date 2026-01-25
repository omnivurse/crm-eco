import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  MessageSquare,
  CheckSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '../../components/ui/Toaster';
import { CardSkeleton } from '../../components/ui/SkeletonLoader';

interface Request {
  id: string;
  status: string;
  priority: string;
  form_data: any;
  created_at: string;
  updated_at: string;
  catalog_item: {
    name: string;
    description: string;
    category: {
      name: string;
    };
  };
  requester: {
    full_name: string;
    email: string;
  };
  approver: {
    full_name: string;
    email: string;
  } | null;
}

interface Task {
  id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  assignee: {
    full_name: string;
  } | null;
}

export function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [request, setRequest] = useState<Request | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (id) {
      fetchRequest();
      fetchTasks();
    }
  }, [id]);

  const fetchRequest = async () => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          catalog_item:catalog_items(
            name,
            description,
            category:catalog_categories(name)
          ),
          requester:profiles!requests_requester_id_fkey(full_name, email),
          approver:profiles!requests_approver_id_fkey(full_name, email)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setRequest(data);
    } catch (error) {
      console.error('Error fetching request:', error);
      toast({ type: 'error', title: 'Failed to load request' });
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('request_tasks')
        .select(`
          *,
          assignee:profiles(full_name)
        `)
        .eq('request_id', id)
        .order('order_index');

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const handleApprove = async () => {
    try {
      const { error } = await supabase
        .from('request_approvals')
        .insert({
          request_id: id,
          approver_id: profile?.id,
          decision: 'approved',
          comments: comment,
        });

      if (error) throw error;

      await supabase
        .from('requests')
        .update({ status: 'approved', approver_id: profile?.id })
        .eq('id', id);

      toast({ type: 'success', title: 'Request approved' });
      setComment('');
      fetchRequest();
    } catch (error) {
      console.error('Error approving request:', error);
      toast({ type: 'error', title: 'Failed to approve request' });
    }
  };

  const handleReject = async () => {
    try {
      const { error } = await supabase
        .from('request_approvals')
        .insert({
          request_id: id,
          approver_id: profile?.id,
          decision: 'rejected',
          comments: comment,
        });

      if (error) throw error;

      await supabase
        .from('requests')
        .update({ status: 'rejected', approver_id: profile?.id })
        .eq('id', id);

      toast({ type: 'success', title: 'Request rejected' });
      setComment('');
      fetchRequest();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast({ type: 'error', title: 'Failed to reject request' });
    }
  };

  const handleToggleTask = async (taskId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('request_tasks')
        .update({
          is_completed: !currentState,
          completed_at: !currentState ? new Date().toISOString() : null,
        })
        .eq('id', taskId);

      if (error) throw error;
      toast({ type: 'success', title: 'Task updated' });
      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      toast({ type: 'error', title: 'Failed to update task' });
    }
  };

  if (loading) return <CardSkeleton />;
  if (!request) return <div>Request not found</div>;

  const isAgent = ['agent', 'admin', 'super_admin'].includes(profile?.role || '');

  return (
    <div>
      <button
        onClick={() => navigate('/requests')}
        className="inline-flex items-center gap-2 mb-6 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
      >
        <ArrowLeft size={20} />
        Back to Requests
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                  {request.catalog_item?.name}
                </h1>
                <p className="text-neutral-600 dark:text-neutral-400">
                  {request.catalog_item?.description}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                request.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                request.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
              }`}>
                {request.status}
              </span>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-neutral-900 dark:text-white">Request Details</h3>
              {request.form_data && Object.entries(request.form_data).map(([key, value]) => (
                <div key={key} className="grid grid-cols-3 gap-4 py-2 border-b border-neutral-200 dark:border-neutral-700">
                  <div className="font-medium text-neutral-700 dark:text-neutral-300">{key}</div>
                  <div className="col-span-2 text-neutral-900 dark:text-white">{String(value)}</div>
                </div>
              ))}
            </div>
          </div>

          {tasks.length > 0 && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                <CheckSquare size={20} />
                Fulfillment Tasks
              </h3>
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={task.is_completed}
                      onChange={() => handleToggleTask(task.id, task.is_completed)}
                      disabled={!isAgent}
                      className="w-5 h-5 rounded border-neutral-300"
                    />
                    <div className="flex-1">
                      <div className={`font-medium ${task.is_completed ? 'line-through text-neutral-500' : 'text-neutral-900 dark:text-white'}`}>
                        {task.title}
                      </div>
                      {task.assignee && (
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          Assigned to {task.assignee.full_name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {request.status === 'pending' && isAgent && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">Approval Decision</h3>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add comments (optional)..."
                className="w-full p-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white mb-4"
                rows={3}
              />
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-2 px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-xl transition-colors"
                >
                  <CheckCircle2 size={18} />
                  Approve
                </button>
                <button
                  onClick={handleReject}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl transition-colors"
                >
                  <XCircle size={18} />
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">Request Information</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Requester</div>
                <div className="flex items-center gap-2">
                  <User size={16} className="text-neutral-400" />
                  <span className="text-neutral-900 dark:text-white">{request.requester?.full_name}</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Created</div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-neutral-400" />
                  <span className="text-neutral-900 dark:text-white">
                    {format(new Date(request.created_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              </div>
              {request.approver && (
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Approver</div>
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-neutral-400" />
                    <span className="text-neutral-900 dark:text-white">{request.approver.full_name}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
