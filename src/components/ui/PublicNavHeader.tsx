import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../../providers/AuthProvider';

interface PublicNavHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  backPath?: string;
  backLabel?: string;
}

export function PublicNavHeader({
  title,
  subtitle,
  showBackButton = true,
  backPath = '/support',
  backLabel = 'Back to Support Portal'
}: PublicNavHeaderProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isAuthenticated = !!profile;
  const isStaffOrAdmin = profile?.role && ['staff', 'agent', 'admin', 'super_admin'].includes(profile.role);

  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isStaffOrAdmin) {
      navigate('/dashboard');
    } else if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate(backPath);
    }
  };

  return (
    <div className="glass-card border-b border-white/10 rounded-none mb-6">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <Logo size="small" />
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-800 text-white hover:bg-primary-700 transition-colors text-sm font-medium"
              >
                <Home size={16} />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-800 text-white hover:bg-primary-700 transition-colors text-sm font-medium"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>

        {showBackButton && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-4"
          >
            <button
              onClick={handleBackClick}
              className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-800 dark:hover:text-primary-500 transition-colors"
            >
              <ArrowLeft size={18} />
              <span className="text-sm font-medium">
                {isStaffOrAdmin ? 'Back to Dashboard' : backLabel}
              </span>
            </button>
          </motion.div>
        )}

        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
