import { Navigate } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';

const roleHierarchy = {
  member: 0,
  advisor: 1,
  concierge: 2,
  staff: 3,
  agent: 4,
  admin: 5,
  super_admin: 6,
};

interface RequireRoleProps {
  children: React.ReactNode;
  min: keyof typeof roleHierarchy;
}

export default function RequireRole({ children, min }: RequireRoleProps) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  if (!profile || roleHierarchy[profile.role] < roleHierarchy[min]) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
