'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Badge,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@crm-eco/ui';
import {
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Search,
  ChevronLeft,
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
import Link from 'next/link';
import { toast } from 'sonner';

interface Feature {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  is_highlighted: boolean;
  is_system: boolean;
  sort_order: number;
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

export default function FeaturesLibraryPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showNewFeature, setShowNewFeature] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // New feature form
  const [newFeature, setNewFeature] = useState({
    name: '',
    description: '',
    category: 'general',
    is_highlighted: false,
  });

  const supabase = createClient();

  const loadFeatures = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single() as { data: { organization_id: string } | null };

      if (!profile) return;
      setOrganizationId(profile.organization_id);

      const { data } = await supabase
        .from('product_features_library')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('category')
        .order('sort_order');

      setFeatures(data || []);
    } catch (error) {
      console.error('Error loading features:', error);
      toast.error('Failed to load features');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  const handleCreateFeature = async () => {
    if (!newFeature.name.trim() || !organizationId) return;

    setIsSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
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
      toast.success('Feature deleted');
    } catch (error) {
      console.error('Error deleting feature:', error);
      toast.error('Failed to delete feature');
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Features Library</h1>
          <p className="text-slate-500">Manage the features catalog for your products</p>
        </div>
        <Button onClick={() => setShowNewFeature(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Feature
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <List className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{features.length}</p>
                <p className="text-sm text-muted-foreground">Total Features</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{features.filter(f => f.is_highlighted).length}</p>
                <p className="text-sm text-muted-foreground">Highlighted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Object.keys(groupedFeatures).length}</p>
                <p className="text-sm text-muted-foreground">Categories Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Features */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Features</CardTitle>
              <CardDescription>
                {filteredFeatures.length} features found
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search features..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedFeatures).length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <List className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No features found</p>
              <p className="text-sm mb-4">Create your first feature to get started</p>
              <Button onClick={() => setShowNewFeature(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Feature
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => {
                const Icon = getCategoryIcon(category);
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="h-5 w-5 text-slate-500" />
                      <h3 className="font-medium text-slate-700">{getCategoryLabel(category)}</h3>
                      <Badge variant="secondary">{categoryFeatures.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {categoryFeatures.map((feature) => (
                        <div
                          key={feature.id}
                          className="border rounded-lg p-4 hover:border-teal-500/50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{feature.name}</span>
                                {feature.is_highlighted && (
                                  <Sparkles className="h-4 w-4 text-amber-500" />
                                )}
                              </div>
                              {feature.description && (
                                <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                                  {feature.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingFeature(feature)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              {!feature.is_system && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteFeature(feature.id)}
                                  className="text-red-500 hover:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
