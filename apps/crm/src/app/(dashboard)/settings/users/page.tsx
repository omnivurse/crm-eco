import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getRoleQueryContext } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@crm-eco/ui';
import { Users, Shield, Crown, UserCog, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@crm-eco/lib/types';
import { RoleSelect } from '@/components/settings/role-select';

type Profile = Database['public']['Tables']['profiles']['Row'];

async function getProfiles(): Promise<Profile[]> {
  const supabase = await createServerSupabaseClient();
  const context = await getRoleQueryContext();
  
  if (!context) return [];
  
  // Only owner/admin can access settings
  if (!context.isAdmin) {
    redirect('/dashboard');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', context.organizationId)
    .order('created_at', { ascending: true });
  
  if (error) return [];
  return data as Profile[];
}

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700 border-purple-300',
  admin: 'bg-blue-100 text-blue-700 border-blue-300',
  staff: 'bg-slate-100 text-slate-700 border-slate-300',
  advisor: 'bg-emerald-100 text-emerald-700 border-emerald-300',
};

const roleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  staff: UserCog,
  advisor: UserCheck,
};

export default async function UsersSettingsPage() {
  const context = await getRoleQueryContext();
  const profiles = await getProfiles();
  
  if (!context) {
    redirect('/dashboard');
  }

  // Count owners to prevent demoting the last one
  const ownerCount = profiles.filter(p => p.role === 'owner').length;
  const isOwner = context.role === 'owner';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Users & Roles</CardTitle>
              <CardDescription>
                Manage team members and their access levels
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium">No users found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {isOwner && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => {
                  const RoleIcon = roleIcons[profile.role] || UserCog;
                  const isCurrentUser = profile.id === context.profileId;
                  const isLastOwner = profile.role === 'owner' && ownerCount === 1;
                  
                  return (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center text-white font-medium">
                            {(profile.full_name || profile.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{profile.full_name || profile.display_name || 'Unknown'}</p>
                            {isCurrentUser && (
                              <Badge variant="outline" className="text-xs">You</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500">{profile.email}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`${roleColors[profile.role]} capitalize flex items-center gap-1 w-fit`}
                        >
                          <RoleIcon className="w-3 h-3" />
                          {profile.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {format(new Date(profile.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      {isOwner && (
                        <TableCell>
                          {isLastOwner && profile.role === 'owner' ? (
                            <span className="text-xs text-slate-400">Last owner</span>
                          ) : (
                            <RoleSelect
                              profileId={profile.id}
                              currentRole={profile.role}
                              isCurrentUser={isCurrentUser}
                            />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role Descriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Role Permissions</CardTitle>
          <CardDescription>
            Understanding access levels in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg border border-purple-200 bg-purple-50">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-purple-900">Owner</h3>
              </div>
              <p className="text-sm text-purple-700">
                Full access to all features including organization settings, user management, and billing.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Admin</h3>
              </div>
              <p className="text-sm text-blue-700">
                Access to all CRM features and settings, except billing and ownership transfer.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <UserCog className="w-5 h-5 text-slate-600" />
                <h3 className="font-semibold text-slate-900">Staff</h3>
              </div>
              <p className="text-sm text-slate-700">
                Access to member management, tickets, and needs. Cannot access settings or user management.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-2 mb-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-emerald-900">Advisor</h3>
              </div>
              <p className="text-sm text-emerald-700">
                Access only to their assigned members, leads, and related tickets/needs.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

