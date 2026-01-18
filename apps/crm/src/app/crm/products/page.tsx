'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  Package,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Tag,
  Grid3X3,
  List,
  Loader2,
  Copy,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@crm-eco/ui/components/dialog';
import { toast } from 'sonner';
import { cn } from '@crm-eco/ui/lib/utils';

// ============================================================================
// Type Definitions
// ============================================================================

interface Product {
  id: string;
  name: string;
  label: string | null;
  description: string | null;
  category: string | null;
  provider: string | null;
  status: string;
  is_public: boolean;
  min_age: number;
  max_age: number;
  color: string | null;
  icon: string | null;
  features: string[];
  created_at: string;
  updated_at: string;
}

interface ProductFormData {
  name: string;
  label: string;
  description: string;
  category: string;
  provider: string;
  status: string;
  is_public: boolean;
  min_age: number;
  max_age: number;
  color: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-emerald-500/10 text-emerald-600' },
  { value: 'inactive', label: 'Inactive', color: 'bg-slate-500/10 text-slate-600' },
  { value: 'draft', label: 'Draft', color: 'bg-amber-500/10 text-amber-600' },
];

const CATEGORY_OPTIONS = [
  'Health Sharing',
  'Dental',
  'Vision',
  'Life',
  'Supplemental',
  'Other',
];

const COLOR_OPTIONS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#8B5CF6', // violet
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#6366F1', // indigo
];

// ============================================================================
// Components
// ============================================================================

function ProductCard({
  product,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const status = STATUS_OPTIONS.find(s => s.value === product.status) || STATUS_OPTIONS[0];

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-teal-500/50 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${product.color || '#3B82F6'}20` }}
          >
            <Package className="w-5 h-5" style={{ color: product.color || '#3B82F6' }} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {product.name}
            </h3>
            {product.label && (
              <p className="text-sm text-slate-500">{product.label}</p>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Product
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="w-4 h-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {product.description && (
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
          {product.description}
        </p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', status.color)}>
            {status.label}
          </span>
          {product.category && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {product.category}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          Ages {product.min_age}-{product.max_age}
        </span>
      </div>
    </div>
  );
}

function ProductModal({
  open,
  onOpenChange,
  product,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSave: (data: ProductFormData) => Promise<void>;
}) {
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    label: '',
    description: '',
    category: '',
    provider: '',
    status: 'active',
    is_public: true,
    min_age: 0,
    max_age: 64,
    color: '#3B82F6',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        label: product.label || '',
        description: product.description || '',
        category: product.category || '',
        provider: product.provider || '',
        status: product.status,
        is_public: product.is_public,
        min_age: product.min_age,
        max_age: product.max_age,
        color: product.color || '#3B82F6',
      });
    } else {
      setFormData({
        name: '',
        label: '',
        description: '',
        category: '',
        provider: '',
        status: 'active',
        is_public: true,
        min_age: 0,
        max_age: 64,
        color: '#3B82F6',
      });
    }
  }, [product, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    setSaving(true);
    try {
      await onSave(formData);
      onOpenChange(false);
    } catch {
      // Error handled in parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Create Product'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Product Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard Health Plan"
                className="w-full"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Display Label
              </label>
              <Input
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Short display name"
                className="w-full"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Product description..."
                rows={3}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Select category</option>
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Provider
              </label>
              <Input
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                placeholder="e.g., BlueCross"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Color
              </label>
              <div className="flex items-center gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={cn(
                      'w-6 h-6 rounded-full transition-all',
                      formData.color === color && 'ring-2 ring-offset-2 ring-slate-400'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Min Age
              </label>
              <Input
                type="number"
                value={formData.min_age}
                onChange={(e) => setFormData({ ...formData, min_age: parseInt(e.target.value) || 0 })}
                min={0}
                max={120}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Max Age
              </label>
              <Input
                type="number"
                value={formData.max_age}
                onChange={(e) => setFormData({ ...formData, max_age: parseInt(e.target.value) || 64 })}
                min={0}
                max={120}
                className="w-full"
              />
            </div>

            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_public}
                  onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Make this product publicly visible
                </span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {product ? 'Save Changes' : 'Create Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function ProductsPage() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;
      setOrganizationId(profile.organization_id);

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setProducts((data || []) as Product[]);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProduct(data: ProductFormData) {
    if (!organizationId) return;

    try {
      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update({
            name: data.name,
            label: data.label || null,
            description: data.description || null,
            category: data.category || null,
            provider: data.provider || null,
            status: data.status,
            is_public: data.is_public,
            min_age: data.min_age,
            max_age: data.max_age,
            color: data.color,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast.success('Product updated successfully');
      } else {
        // Create new product
        const { error } = await supabase
          .from('products')
          .insert({
            organization_id: organizationId,
            name: data.name,
            label: data.label || null,
            description: data.description || null,
            category: data.category || null,
            provider: data.provider || null,
            status: data.status,
            is_public: data.is_public,
            min_age: data.min_age,
            max_age: data.max_age,
            color: data.color,
            sort_order: products.length,
          });

        if (error) throw error;
        toast.success('Product created successfully');
      }

      await loadProducts();
      setEditingProduct(null);
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
      throw error;
    }
  }

  async function handleDeleteProduct(product: Product) {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;
      toast.success('Product deleted successfully');
      await loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  }

  async function handleDuplicateProduct(product: Product) {
    if (!organizationId) return;

    try {
      const { error } = await supabase
        .from('products')
        .insert({
          organization_id: organizationId,
          name: `${product.name} (Copy)`,
          label: product.label,
          description: product.description,
          category: product.category,
          provider: product.provider,
          status: 'draft',
          is_public: false,
          min_age: product.min_age,
          max_age: product.max_age,
          color: product.color,
          features: product.features,
          sort_order: products.length,
        });

      if (error) throw error;
      toast.success('Product duplicated successfully');
      await loadProducts();
    } catch (error) {
      console.error('Error duplicating product:', error);
      toast.error('Failed to duplicate product');
    }
  }

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl">
            <Package className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Products</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Define your products and services for quotes and invoices
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            setEditingProduct(null);
            setShowModal(true);
          }}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="pl-10"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Status</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-2 rounded transition-colors',
              viewMode === 'grid'
                ? 'bg-white dark:bg-slate-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'p-2 rounded transition-colors',
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Products Grid/List */}
      {filteredProducts.length > 0 ? (
        <div className={cn(
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-3'
        )}>
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={() => {
                setEditingProduct(product);
                setShowModal(true);
              }}
              onDelete={() => handleDeleteProduct(product)}
              onDuplicate={() => handleDuplicateProduct(product)}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
          <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 w-fit mx-auto mb-4">
            <Package className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-900 dark:text-white font-medium mb-1">
            {searchQuery || statusFilter !== 'all' ? 'No matching products' : 'No products yet'}
          </p>
          <p className="text-slate-500 text-sm mb-4">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first product to get started'
            }
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Button
              onClick={() => {
                setEditingProduct(null);
                setShowModal(true);
              }}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Product
            </Button>
          )}
        </div>
      )}

      {/* Product Modal */}
      <ProductModal
        open={showModal}
        onOpenChange={setShowModal}
        product={editingProduct}
        onSave={handleSaveProduct}
      />
    </div>
  );
}
