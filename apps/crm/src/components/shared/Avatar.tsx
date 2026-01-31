'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@crm-eco/ui/lib/utils';
import { User } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallbackClassName?: string;
}

const sizeMap = {
  xs: { container: 'w-6 h-6', image: 24, icon: 'w-3 h-3' },
  sm: { container: 'w-8 h-8', image: 32, icon: 'w-4 h-4' },
  md: { container: 'w-10 h-10', image: 40, icon: 'w-5 h-5' },
  lg: { container: 'w-12 h-12', image: 48, icon: 'w-6 h-6' },
  xl: { container: 'w-16 h-16', image: 64, icon: 'w-8 h-8' },
};

export function Avatar({
  src,
  alt = '',
  size = 'md',
  className,
  fallbackClassName,
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const { container, image, icon } = sizeMap[size];

  // Show fallback if no src or error loading
  if (!src || hasError) {
    return (
      <div
        className={cn(
          container,
          'rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center',
          fallbackClassName,
          className
        )}
      >
        <User className={cn(icon, 'text-slate-400 dark:text-slate-500')} />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={image}
      height={image}
      className={cn(container, 'rounded-full object-cover', className)}
      onError={() => setHasError(true)}
    />
  );
}

export default Avatar;
