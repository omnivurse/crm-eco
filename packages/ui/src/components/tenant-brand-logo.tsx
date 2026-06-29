import * as React from 'react';
import { cn } from '../lib/utils';
import { resolveBrandDisplay } from '../lib/branding';
import {
  BrandLogo,
  type BrandLogoProps,
  type BrandLogoSize,
} from './brand-logo';

export interface TenantBrandLogoProps extends Omit<BrandLogoProps, 'alt'> {
  branding?: Record<string, unknown> | null;
  orgName?: string | null;
  alt?: string;
}

const TENANT_FULL_SIZE: Record<BrandLogoSize, string> = {
  xs: 'h-8 max-w-[140px]',
  sm: 'h-8 lg:h-9 max-w-[160px]',
  md: 'h-10 max-w-[180px]',
  lg: 'h-14 max-w-[220px]',
  xl: 'h-16 max-w-[260px]',
};

const TENANT_ICON_SIZE: Record<BrandLogoSize, string> = {
  xs: 'h-8 w-8',
  sm: 'h-9 w-9',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
  xl: 'h-16 w-16',
};

/**
 * Tenant-aware logo — uses organizations.branding.logo_url when present,
 * otherwise falls back to the platform Double Helix mark.
 */
export function TenantBrandLogo({
  branding,
  orgName,
  variant = 'full',
  size = 'sm',
  tone = 'auto',
  priority = false,
  alt,
  className,
}: TenantBrandLogoProps) {
  const { logoUrl, companyName } = resolveBrandDisplay(branding, orgName);
  const resolvedAlt = alt ?? companyName ?? 'Organization logo';

  if (logoUrl) {
    const sizeClass =
      variant === 'icon' ? TENANT_ICON_SIZE[size] : TENANT_FULL_SIZE[size];
    return (
      <img
        src={logoUrl}
        alt={resolvedAlt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className={cn('object-contain object-left', sizeClass, className)}
      />
    );
  }

  return (
    <BrandLogo
      variant={variant}
      size={size}
      tone={tone}
      priority={priority}
      alt={resolvedAlt}
      className={className}
    />
  );
}
