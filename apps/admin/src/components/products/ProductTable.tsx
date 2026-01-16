'use client';

import { Badge, Button } from '@crm-eco/ui';
import { Eye, Package } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface Product {
  id: string;
  name: string;
  code: string;
  product_line: string | null;
  coverage_category: string | null;
  tier: string | null;
  monthly_share: number | null;
  iua_amount: number | null;
  is_active: boolean;
  effective_start_date: string | null;
  effective_end_date: string | null;
  created_at: string;
}

interface ProductTableProps {
  products: Product[];
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function ProductTable({ products }: ProductTableProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">No products found</p>
        <Link href="/products/new" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
          Add your first product
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-3 font-medium text-slate-500 text-sm">Name</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">Code</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">Product Line</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">Category</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">Monthly Share</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">IUA</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">Effective Dates</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">Status</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b hover:bg-slate-50">
              <td className="py-3">
                <p className="text-sm font-medium">{product.name}</p>
              </td>
              <td className="py-3 text-sm font-mono">{product.code}</td>
              <td className="py-3 text-sm">
                {product.product_line || <span className="text-slate-400">—</span>}
              </td>
              <td className="py-3 text-sm">
                {product.coverage_category || <span className="text-slate-400">—</span>}
              </td>
              <td className="py-3 text-sm font-medium">
                {formatCurrency(product.monthly_share)}
              </td>
              <td className="py-3 text-sm">
                {formatCurrency(product.iua_amount)}
              </td>
              <td className="py-3 text-sm">
                {product.effective_start_date ? (
                  <span>
                    {format(new Date(product.effective_start_date), 'MMM d, yyyy')}
                    {product.effective_end_date && (
                      <> - {format(new Date(product.effective_end_date), 'MMM d, yyyy')}</>
                    )}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="py-3">
                <Badge variant={product.is_active ? 'default' : 'secondary'}>
                  {product.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td className="py-3">
                <Link href={`/products/${product.id}`}>
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
