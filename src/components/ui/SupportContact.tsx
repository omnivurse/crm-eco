import { Phone, Mail } from 'lucide-react';

interface SupportContactProps {
  variant?: 'card' | 'inline' | 'minimal';
  showEmail?: boolean;
  className?: string;
}

export function SupportContact({
  variant = 'card',
  showEmail = true,
  className = ''
}: SupportContactProps) {
  const phoneNumber = '+1 561 203 6529';
  const extension = '1012';
  const email = 'support@mympb.com';

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <Phone size={16} className="text-primary-800 dark:text-primary-500" />
        <a
          href={`tel:${phoneNumber.replace(/\s/g, '')},${extension}`}
          className="text-neutral-700 dark:text-neutral-300 hover:text-primary-800 dark:hover:text-primary-500 transition-colors"
        >
          {phoneNumber} ext {extension}
        </a>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`flex flex-wrap items-center gap-4 ${className}`}>
        <div className="flex items-center gap-2">
          <Phone size={18} className="text-primary-800 dark:text-primary-500" />
          <div>
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">IT Support: </span>
            <a
              href={`tel:${phoneNumber.replace(/\s/g, '')},${extension}`}
              className="text-sm font-semibold text-primary-800 dark:text-primary-500 hover:underline"
            >
              {phoneNumber} ext {extension}
            </a>
          </div>
        </div>
        {showEmail && (
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-primary-800 dark:text-primary-500" />
            <a
              href={`mailto:${email}`}
              className="text-sm font-semibold text-primary-800 dark:text-primary-500 hover:underline"
            >
              {email}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center flex-shrink-0">
          <Phone className="text-white" size={24} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
            Need Immediate Help?
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
            Please open a ticket before calling. Contact our IT Support team for assistance.
          </p>
          <div className="space-y-2">
            <a
              href={`tel:${phoneNumber.replace(/\s/g, '')},${extension}`}
              className="flex items-center gap-2 text-neutral-900 dark:text-white hover:text-primary-800 dark:hover:text-primary-500 transition-colors group"
            >
              <Phone size={18} className="text-primary-800 dark:text-primary-500 group-hover:scale-110 transition-transform" />
              <span className="font-semibold">{phoneNumber} ext {extension}</span>
            </a>
            {showEmail && (
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-2 text-neutral-900 dark:text-white hover:text-primary-800 dark:hover:text-primary-500 transition-colors group"
              >
                <Mail size={18} className="text-primary-800 dark:text-primary-500 group-hover:scale-110 transition-transform" />
                <span className="font-medium">{email}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
