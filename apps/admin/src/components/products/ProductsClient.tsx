'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
} from '@crm-eco/ui';
import { Search, Filter, X, DollarSign, Eye, Edit, Copy, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

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

interface ProductsClientProps {
  products: Product[];
  organizationId: string;
  categories: string[];
}

export function ProductsClient({ products, organizationId, categories }: ProductsClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Search filter
      const matchesSearch =
        !searchQuery ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.product_line?.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && product.is_active) ||
        (statusFilter === 'inactive' && !product.is_active);

      // Category filter
      const matchesCategory = !categoryFilter || product.coverage_category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [products, searchQuery, statusFilter, categoryFilter]);

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleDuplicate = async (product: Product) => {
    try {
      const { data, error } = await (supabase as any)
        .from('plans')
        .insert({
          organization_id: organizationId,
          name: `${product.name} (Copy)`,
          code: `${product.code}-COPY`,
          product_line: product.product_line,
          coverage_category: product.coverage_category,
          tier: product.tier,
          monthly_share: product.monthly_share,
          iua_amount: product.iua_amount,
          is_active: false,
        })
        .select('id')
        .single();

      if (error) throw error;

      toast.success('Product duplicated');
      router.push(`/products/${(data as { id: string }).id}`);
    } catch (error) {
      console.error('Error duplicating product:', error);
      toast.error('Failed to duplicate product');
    }
  };

  const handleDelete = async (productId: string, productName: string) => {
    if (!confirm(`Delete "${productName}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabase.from('plans').delete().eq('id', productId);

      if (error) throw error;

      toast.success('Product deleted');
      router.refresh();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCategoryFilter('');
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || categoryFilter;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>All Products</CardTitle>
            <CardDescription>
              {filteredProducts.length} of {products.length} products
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-slate-100' : ''}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  Active
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="flex items-center gap-4 pt-4 border-t mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Status:</span>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Category:</span>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="text-lg font-medium">No products found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Category</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Tier</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Monthly</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">IUA</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <Link href={`/products/${product.id}`} className="hover:text-teal-600">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-slate-500 font-mono">{product.code}</p>
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      {product.coverage_category && (
                        <Badge variant="outline">{product.coverage_category}</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {product.tier && (
                        <Badge
                          variant="secondary"
                          className={
                            product.tier === 'Gold'
                              ? 'bg-amber-100 text-amber-700'
                              : product.tier === 'Silver'
                                ? 'bg-slate-200 text-slate-700'
                                : product.tier === 'Platinum'
                                  ? 'bg-purple-100 text-purple-700'
                                  : ''
                          }
                        >
                          {product.tier}
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {formatCurrency(product.monthly_share)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(product.iua_amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={product.is_active ? 'default' : 'secondary'}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/products/${product.id}`}>
                          <Button variant="ghost" size="icon" title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/products/${product.id}/pricing`}>
                          <Button variant="ghost" size="icon" title="Pricing">
                            <DollarSign className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/products/${product.id}/edit`}>
                          <Button variant="ghost" size="icon" title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Duplicate"
                          onClick={() => handleDuplicate(product)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          onClick={() => handleDelete(product.id, product.name)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
