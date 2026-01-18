'use client';

import Link from 'next/link';
import { Badge, Button } from '@crm-eco/ui';
import { Eye, Edit, Building2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Vendor } from '@crm-eco/lib/types';

interface VendorTableProps {
  vendors: Vendor[];
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    active: { label: 'Active', variant: 'default' },
    inactive: { label: 'Inactive', variant: 'secondary' },
    pending: { label: 'Pending', variant: 'outline' },
    suspended: { label: 'Suspended', variant: 'destructive' },
  };

  const config = statusConfig[status] || { label: status, variant: 'secondary' as const };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// Vendor Type Badge
function VendorTypeBadge({ type }: { type: string }) {
  const displayName = type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  return (
    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
      {displayName}
    </span>
  );
}

export function VendorTable({ vendors }: VendorTableProps) {
  if (vendors.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-1">No vendors yet</h3>
        <p className="text-slate-500 mb-4">Get started by adding your first vendor integration</p>
        <Link href="/vendors/new">
          <Button>Add Vendor</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Vendor</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Code</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Type</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Connection</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Status</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Last Sync</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((vendor) => (
            <tr key={vendor.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    {vendor.logo_url ? (
                      <img src={vendor.logo_url} alt={vendor.name} className="w-6 h-6" />
                    ) : (
                      <Building2 className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{vendor.name}</p>
                    {vendor.contact_email && (
                      <p className="text-sm text-slate-500">{vendor.contact_email}</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="py-3 px-4">
                <code className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-700">
                  {vendor.code}
                </code>
              </td>
              <td className="py-3 px-4">
                <VendorTypeBadge type={vendor.vendor_type} />
              </td>
              <td className="py-3 px-4">
                <span className="capitalize text-sm text-slate-600">
                  {vendor.connection_type}
                </span>
                {vendor.sync_enabled && (
                  <Badge variant="outline" className="ml-2 text-xs">Auto</Badge>
                )}
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={vendor.status} />
              </td>
              <td className="py-3 px-4">
                {vendor.last_sync_at ? (
                  <span className="text-sm text-slate-500">
                    {formatDistanceToNow(new Date(vendor.last_sync_at), { addSuffix: true })}
                  </span>
                ) : (
                  <span className="text-sm text-slate-400">Never</span>
                )}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center justify-end gap-1">
                  <Link href={`/vendors/${vendor.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href={`/vendors/${vendor.id}/edit`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
