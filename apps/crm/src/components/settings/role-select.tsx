'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import type { UserRole } from '@crm-eco/lib';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@crm-eco/ui';

interface RoleSelectProps {
  profileId: string;
  currentRole: string;
  isCurrentUser: boolean;
}

const roles: { value: UserRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'Staff' },
  { value: 'advisor', label: 'Advisor' },
];

export function RoleSelect({ profileId, currentRole, isCurrentUser }: RoleSelectProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoleChange = async (newRole: string) => {
    if (newRole === currentRole) return;
    
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const typedRole = newRole as UserRole;

      const { error: updateError } = await (supabase
        .from('profiles') as any)
        .update({ role: typedRole })
        .eq('id', profileId);

      if (updateError) throw updateError;

      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update role';
      setError(message);
      console.error('Error updating role:', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-32">
      <Select
        value={currentRole}
        onValueChange={handleRoleChange}
        disabled={loading || isCurrentUser}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem key={role.value} value={role.value} className="text-xs">
              {role.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}

