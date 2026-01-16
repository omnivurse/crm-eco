'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { 
  Users, 
  Plus,
  User,
  Calendar,
  Heart,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  UserPlus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@crm-eco/ui/components/dialog';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { toast } from 'sonner';

interface Dependent {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  relationship: string;
  is_covered: boolean;
  created_at: string;
}

export default function DependentsPage() {
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDependent, setEditingDependent] = useState<Dependent | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    relationship: '',
  });

  const supabase = createClient();

  useEffect(() => {
    fetchDependents();
  }, []);

  const fetchDependents = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get profile to find member
    const { data: profile } = await supabase
      .from('profiles')
      .select('member_id, organization_id')
      .eq('user_id', user.id)
      .single() as { data: { member_id: string; organization_id: string } | null };

    if (!profile?.member_id) {
      setLoading(false);
      return;
    }

    setMemberId(profile.member_id);
    setOrganizationId(profile.organization_id);

    const { data, error } = await (supabase as any)
      .from('dependents')
      .select('*')
      .eq('member_id', profile.member_id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDependents(data);
    }
    setLoading(false);
  };

  const handleOpenDialog = (dependent?: Dependent) => {
    if (dependent) {
      setEditingDependent(dependent);
      setFormData({
        first_name: dependent.first_name,
        last_name: dependent.last_name,
        date_of_birth: dependent.date_of_birth || '',
        gender: dependent.gender || '',
        relationship: dependent.relationship,
      });
    } else {
      setEditingDependent(null);
      setFormData({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        gender: '',
        relationship: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!memberId || !organizationId) return;
    
    setSaving(true);

    if (editingDependent) {
      // Update
      const { error } = await (supabase as any)
        .from('dependents')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          date_of_birth: formData.date_of_birth || null,
          gender: formData.gender || null,
          relationship: formData.relationship,
        })
        .eq('id', editingDependent.id);

      if (error) {
        toast.error('Failed to update dependent');
      } else {
        toast.success('Dependent updated successfully!');
        setDialogOpen(false);
        fetchDependents();
      }
    } else {
      // Create
      const { error } = await (supabase as any)
        .from('dependents')
        .insert({
          member_id: memberId,
          organization_id: organizationId,
          first_name: formData.first_name,
          last_name: formData.last_name,
          date_of_birth: formData.date_of_birth || null,
          gender: formData.gender || null,
          relationship: formData.relationship,
          is_covered: true,
        });

      if (error) {
        toast.error('Failed to add dependent');
      } else {
        toast.success('Dependent added successfully!');
        setDialogOpen(false);
        fetchDependents();
      }
    }

    setSaving(false);
  };

  const handleDelete = async (dependent: Dependent) => {
    if (!confirm(`Are you sure you want to remove ${dependent.first_name} ${dependent.last_name}?`)) {
      return;
    }

    const { error } = await (supabase as any)
      .from('dependents')
      .delete()
      .eq('id', dependent.id);

    if (error) {
      toast.error('Failed to remove dependent');
    } else {
      toast.success('Dependent removed successfully');
      fetchDependents();
    }
  };

  const calculateAge = (dob: string | null) => {
    if (!dob) return null;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getRelationshipIcon = (relationship: string) => {
    switch (relationship.toLowerCase()) {
      case 'spouse': return <Heart className="h-4 w-4 text-pink-500" />;
      case 'child': return <User className="h-4 w-4 text-blue-500" />;
      default: return <User className="h-4 w-4 text-slate-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Dependents</h1>
          <p className="text-slate-500">Manage family members on your plan</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Dependent
        </Button>
      </div>

      {dependents.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Dependents</h2>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              You haven't added any dependents to your membership yet. 
              Add your spouse or children to include them in your coverage.
            </p>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add Your First Dependent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dependents.map((dependent) => (
            <Card key={dependent.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="h-6 w-6 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {dependent.first_name} {dependent.last_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {getRelationshipIcon(dependent.relationship)}
                        <span className="text-sm text-slate-500 capitalize">
                          {dependent.relationship}
                        </span>
                        {dependent.date_of_birth && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-sm text-slate-500">
                              Age {calculateAge(dependent.date_of_birth)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenDialog(dependent)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(dependent)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                    {dependent.gender && <span className="capitalize">{dependent.gender}</span>}
                    {dependent.date_of_birth && (
                      <>
                        <span className="mx-2">•</span>
                        <span>Born {new Date(dependent.date_of_birth).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                  <Badge variant={dependent.is_covered ? 'default' : 'secondary'}>
                    {dependent.is_covered ? 'Covered' : 'Not Covered'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDependent ? 'Edit Dependent' : 'Add Dependent'}
            </DialogTitle>
            <DialogDescription>
              {editingDependent 
                ? 'Update the information for this dependent.'
                : 'Add a family member to your health sharing membership.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship">Relationship</Label>
              <Select 
                value={formData.relationship} 
                onValueChange={(value) => setFormData({ ...formData, relationship: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Spouse">Spouse</SelectItem>
                  <SelectItem value="Child">Child</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select 
                  value={formData.gender} 
                  onValueChange={(value) => setFormData({ ...formData, gender: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving || !formData.first_name || !formData.last_name || !formData.relationship}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                editingDependent ? 'Update' : 'Add Dependent'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
