'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { Avatar, AvatarFallback } from '@crm-eco/ui/components/avatar';
import type { CrmProfile, CrmAuditLog, CrmTask, CrmImportJob } from '@/lib/crm/types';
import type { ModuleStats } from '@/lib/crm/queries';
import {
  Users,
  UserPlus,
  DollarSign,
  Building,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Upload,
  Plus,
  ArrowRight,
  FileText,
  Activity,
} from 'lucide-react';

const moduleIcons: Record<string, React.ElementType> = {
  contacts: Users,
  leads: UserPlus,
  deals: DollarSign,
  accounts: Building,
};

interface DashboardClientProps {
  profile: CrmProfile;
  moduleStats: ModuleStats[];
  recentActivity: CrmAuditLog[];
  upcomingTasks: CrmTask[];
  recentImports: CrmImportJob[];
}

export function DashboardClient({
  profile,
  moduleStats,
  recentActivity,
  upcomingTasks,
  recentImports,
}: DashboardClientProps) {
  const router = useRouter();
  
  const firstName = profile.full_name.split(' ')[0];
  const greeting = getGreeting();

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'create':
        return <Plus className="w-4 h-4 text-brand-emerald-600" />;
      case 'update':
        return <Activity className="w-4 h-4 text-brand-teal-600" />;
      case 'delete':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'import':
        return <Upload className="w-4 h-4 text-brand-gold-600" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTaskPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-destructive/10 text-destructive';
      case 'high':
        return 'bg-warning/20 text-warning-foreground';
      default:
        return '';
    }
  };

  const isTaskOverdue = (task: CrmTask) => {
    return task.due_at && new Date(task.due_at) < new Date() && task.status !== 'completed';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy-800">
            {greeting}, {firstName}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening in your CRM today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push('/import')}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button
            onClick={() => router.push('/modules/contacts?new=true')}
            className="bg-brand-teal-600 hover:bg-brand-teal-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Contact
          </Button>
        </div>
      </div>

      {/* Module Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {moduleStats.map((stat) => {
          const Icon = moduleIcons[stat.moduleKey] || FileText;
          return (
            <Link key={stat.moduleKey} href={`/modules/${stat.moduleKey}`}>
              <Card className="hover:shadow-md transition-shadow hover:border-brand-teal-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-lg bg-brand-teal-100 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-brand-teal-600" />
                    </div>
                    {stat.createdThisWeek > 0 && (
                      <Badge variant="secondary" className="bg-brand-emerald-100 text-brand-emerald-700">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        +{stat.createdThisWeek}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-bold text-brand-navy-800">
                      {stat.totalRecords.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">{stat.moduleName}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.slice(0, 6).map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      {getActivityIcon(activity.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="capitalize font-medium">{activity.action}</span>
                        {' '}
                        <span className="text-muted-foreground">{activity.entity.replace('crm_', '')}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">My Tasks</CardTitle>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No upcoming tasks</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 p-3 rounded-lg ${
                      isTaskOverdue(task) ? 'bg-destructive/5' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="mt-0.5">
                      {task.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-brand-emerald-600" />
                      ) : isTaskOverdue(task) ? (
                        <AlertCircle className="w-5 h-5 text-destructive" />
                      ) : (
                        <Clock className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </p>
                      {task.due_at && (
                        <p className={`text-xs ${isTaskOverdue(task) ? 'text-destructive' : 'text-muted-foreground'}`}>
                          Due {format(new Date(task.due_at), 'MMM d')}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className={getTaskPriorityColor(task.priority)}
                    >
                      {task.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Imports */}
      {recentImports.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Recent Imports</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push('/import')}>
              <Plus className="w-4 h-4 mr-1" />
              New Import
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentImports.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {job.file_name || 'CSV Import'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(job.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="secondary"
                      className={
                        job.status === 'completed'
                          ? 'bg-brand-emerald-100 text-brand-emerald-700'
                          : job.status === 'failed'
                          ? 'bg-destructive/10 text-destructive'
                          : job.status === 'processing'
                          ? 'bg-brand-teal-100 text-brand-teal-700'
                          : ''
                      }
                    >
                      {job.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {job.inserted_count} inserted
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
