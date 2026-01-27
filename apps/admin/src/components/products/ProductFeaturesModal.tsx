'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Badge,
  Checkbox,
} from '@crm-eco/ui';
import {
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Search,
  GripVertical,
  Check,
  X,
  Sparkles,
  List,
  Heart,
  Pill,
  Shield,
  Eye,
  Smile,
  Baby,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';

interface Feature {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  is_highlighted: boolean;
  sort_order: number;
}

interface FeatureMapping {
  id: string;
  feature_id: string;
  is_included: boolean;
  custom_value: string | null;
  custom_description: string | null;
  sort_order: number;
  feature?: Feature;
}

interface ProductFeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  organizationId: string;
}

const FEATURE_CATEGORIES = [
  { value: 'general', label: 'General', icon: List },
  { value: 'medical', label: 'Medical', icon: Heart },
  { value: 'prescription', label: 'Prescription', icon: Pill },
  { value: 'preventive', label: 'Preventive', icon: Shield },
  { value: 'emergency', label: 'Emergency', icon: Activity },
  { value: 'mental_health', label: 'Mental Health', icon: Smile },
  { value: 'maternity', label: 'Maternity', icon: Baby },
  { value: 'vision', label: 'Vision', icon: Eye },
  { value: 'wellness', label: 'Wellness', icon: Sparkles },
];

export function ProductFeaturesModal({
  isOpen,
  onClose,
  productId,
  productName,
  organizationId,
}: ProductFeaturesModalProps) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [mappings, setMappings] = useState<FeatureMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showNewFeature, setShowNewFeature] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);

  // New feature form
  const [newFeature, setNewFeature] = useState({
    name: '',
    description: '',
    category: 'general',
    is_highlighted: false,
  });

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load all features in the organization
      const { data: featuresData } = await supabase
        .from('product_features_library')
        .select('*')
        .eq('organization_id', organizationId)
        .order('category')
        .order('sort_order');

      // Load existing mappings for this product
      const { data: mappingsData } = await supabase
        .from('product_feature_mappings')
        .select('*, feature:product_features_library(*)')
        .eq('plan_id', productId)
        .order('sort_order');

      setFeatures(featuresData || []);
      setMappings(mappingsData || []);
    } catch (error) {
      console.error('Error loading features:', error);
      toast.error('Failed to load features');
    } finally {
      setIsLoading(false);
    }
  }, [supabase, organizationId, productId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleCreateFeature = async () => {
    if (!newFeature.name.trim()) return;

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('product_features_library')
        .insert({
          organization_id: organizationId,
          name: newFeature.name,
          description: newFeature.description || null,
          category: newFeature.category,
          is_highlighted: newFeature.is_highlighted,
          sort_order: features.length,
        })
        .select()
        .single();

      if (error) throw error;

      setFeatures([...features, data]);
      setNewFeature({ name: '', description: '', category: 'general', is_highlighted: false });
      setShowNewFeature(false);
      toast.success('Feature created');
    } catch (error) {
      console.error('Error creating feature:', error);
      toast.error('Failed to create feature');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateFeature = async () => {
    if (!editingFeature) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('product_features_library')
        .update({
          name: editingFeature.name,
          description: editingFeature.description,
          category: editingFeature.category,
          is_highlighted: editingFeature.is_highlighted,
        })
        .eq('id', editingFeature.id);

      if (error) throw error;

      setFeatures(features.map(f => f.id === editingFeature.id ? editingFeature : f));
      setEditingFeature(null);
      toast.success('Feature updated');
    } catch (error) {
      console.error('Error updating feature:', error);
      toast.error('Failed to update feature');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFeature = async (featureId: string) => {
    if (!confirm('Delete this feature? It will be removed from all products.')) return;

    try {
      const { error } = await supabase
        .from('product_features_library')
        .delete()
        .eq('id', featureId);

      if (error) throw error;

      setFeatures(features.filter(f => f.id !== featureId));
      setMappings(mappings.filter(m => m.feature_id !== featureId));
      toast.success('Feature deleted');
    } catch (error) {
      console.error('Error deleting feature:', error);
      toast.error('Failed to delete feature');
    }
  };

  const handleToggleFeature = async (feature: Feature) => {
    const existingMapping = mappings.find(m => m.feature_id === feature.id);

    setIsSaving(true);
    try {
      if (existingMapping) {
        // Remove mapping
        const { error } = await supabase
          .from('product_feature_mappings')
          .delete()
          .eq('id', existingMapping.id);

        if (error) throw error;
        setMappings(mappings.filter(m => m.id !== existingMapping.id));
      } else {
        // Add mapping
        const { data, error } = await supabase
          .from('product_feature_mappings')
          .insert({
            plan_id: productId,
            feature_id: feature.id,
            is_included: true,
            sort_order: mappings.length,
          })
          .select('*, feature:product_features_library(*)')
          .single();

        if (error) throw error;
        setMappings([...mappings, data]);
      }
    } catch (error) {
      console.error('Error toggling feature:', error);
      toast.error('Failed to update feature');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateMapping = async (mappingId: string, updates: Partial<FeatureMapping>) => {
    try {
      const { error } = await supabase
        .from('product_feature_mappings')
        .update(updates)
        .eq('id', mappingId);

      if (error) throw error;

      setMappings(mappings.map(m => m.id === mappingId ? { ...m, ...updates } : m));
    } catch (error) {
      console.error('Error updating mapping:', error);
      toast.error('Failed to update');
    }
  };

  const filteredFeatures = features.filter(feature => {
    const matchesSearch = !searchQuery ||
      feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feature.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || feature.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedFeatures = filteredFeatures.reduce((acc, feature) => {
    const category = feature.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(feature);
    return acc;
  }, {} as Record<string, Feature[]>);

  const getCategoryIcon = (category: string) => {
    const cat = FEATURE_CATEGORIES.find(c => c.value === category);
    return cat?.icon || List;
  };

  const getCategoryLabel = (category: string) => {
    const cat = FEATURE_CATEGORIES.find(c => c.value === category);
    return cat?.label || category;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Product Features</DialogTitle>
          <DialogDescription>
            Configure features for {productName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search features..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                className="border rounded-lg px-3 py-2 text-sm"
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
              >
                <option value="">All Categories</option>
                {FEATURE_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              <Button onClick={() => setShowNewFeature(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Feature
              </Button>
            </div>

            {/* Assigned Features Summary */}
            <div className="flex items-center gap-2 p-3 bg-teal-50 rounded-lg border border-teal-200">
              <Check className="h-5 w-5 text-teal-600" />
              <span className="text-sm font-medium text-teal-900">
                {mappings.length} feature{mappings.length !== 1 ? 's' : ''} assigned to this product
              </span>
            </div>

            {/* Features List */}
            <div className="flex-1 overflow-y-auto border rounded-lg">
              {Object.keys(groupedFeatures).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <List className="h-12 w-12 mb-4 opacity-50" />
                  <p>No features found</p>
                  <p className="text-sm">Create your first feature to get started</p>
                </div>
              ) : (
                <div className="divide-y">
                  {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => {
                    const Icon = getCategoryIcon(category);
                    return (
                      <div key={category}>
                        <div className="px-4 py-2 bg-slate-50 border-b flex items-center gap-2">
                          <Icon className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-700">
                            {getCategoryLabel(category)}
                          </span>
                          <Badge variant="secondary" className="ml-auto">
                            {categoryFeatures.length}
                          </Badge>
                        </div>
                        <div className="divide-y">
                          {categoryFeatures.map((feature) => {
                            const mapping = mappings.find(m => m.feature_id === feature.id);
                            const isAssigned = !!mapping;

                            return (
                              <div
                                key={feature.id}
                                className={`flex items-center gap-3 p-3 transition-colors ${
                                  isAssigned ? 'bg-teal-50/50' : 'hover:bg-slate-50'
                                }`}
                              >
                                <Checkbox
                                  checked={isAssigned}
                                  onCheckedChange={() => handleToggleFeature(feature)}
                                  disabled={isSaving}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{feature.name}</span>
                                    {feature.is_highlighted && (
                                      <Sparkles className="h-4 w-4 text-amber-500" />
                                    )}
                                  </div>
                                  {feature.description && (
                                    <p className="text-sm text-slate-500 truncate">
                                      {feature.description}
                                    </p>
                                  )}
                                  {isAssigned && mapping?.custom_value && (
                                    <p className="text-sm text-teal-600 mt-1">
                                      Custom: {mapping.custom_value}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {isAssigned && (
                                    <Input
                                      placeholder="Custom value..."
                                      className="w-32 text-sm"
                                      value={mapping?.custom_value || ''}
                                      onChange={(e) => handleUpdateMapping(mapping!.id, { custom_value: e.target.value || null })}
                                    />
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingFeature(feature)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteFeature(feature.id)}
                                    className="text-red-500 hover:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>

        {/* New Feature Dialog */}
        <Dialog open={showNewFeature} onOpenChange={setShowNewFeature}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Feature</DialogTitle>
              <DialogDescription>
                Add a new feature to your features library
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Feature Name *</Label>
                <Input
                  value={newFeature.name}
                  onChange={(e) => setNewFeature({ ...newFeature, name: e.target.value })}
                  placeholder="e.g., Telehealth Visits"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <textarea
                  value={newFeature.description}
                  onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
                  className="w-full min-h-[80px] px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the feature..."
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={newFeature.category}
                  onChange={(e) => setNewFeature({ ...newFeature, category: e.target.value })}
                >
                  {FEATURE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="highlighted"
                  checked={newFeature.is_highlighted}
                  onCheckedChange={(checked) => setNewFeature({ ...newFeature, is_highlighted: checked === true })}
                />
                <Label htmlFor="highlighted" className="flex items-center gap-1">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Highlight this feature
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewFeature(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFeature} disabled={isSaving || !newFeature.name}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Feature
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Feature Dialog */}
        <Dialog open={!!editingFeature} onOpenChange={() => setEditingFeature(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Feature</DialogTitle>
            </DialogHeader>
            {editingFeature && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Feature Name *</Label>
                  <Input
                    value={editingFeature.name}
                    onChange={(e) => setEditingFeature({ ...editingFeature, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    value={editingFeature.description || ''}
                    onChange={(e) => setEditingFeature({ ...editingFeature, description: e.target.value || null })}
                    className="w-full min-h-[80px] px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={editingFeature.category}
                    onChange={(e) => setEditingFeature({ ...editingFeature, category: e.target.value })}
                  >
                    {FEATURE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-highlighted"
                    checked={editingFeature.is_highlighted}
                    onCheckedChange={(checked) => setEditingFeature({ ...editingFeature, is_highlighted: checked === true })}
                  />
                  <Label htmlFor="edit-highlighted" className="flex items-center gap-1">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Highlight this feature
                  </Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingFeature(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateFeature} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
