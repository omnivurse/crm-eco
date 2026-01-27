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
  Search,
  Users,
  Loader2,
  Filter,
  X,
  Building2,
  MapPin,
  CheckCircle2,
} from 'lucide-react';

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  license_number: string | null;
  license_states: string[] | null;
  commission_tier: string | null;
  organization_id: string;
  organization?: {
    name: string;
  };
}

interface SearchAgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (agents: Agent[]) => void;
  multiSelect?: boolean;
  excludeIds?: string[];
  filterStates?: string[];
  title?: string;
  description?: string;
  enableMultiCorp?: boolean;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

const STATUS_OPTIONS = ['active', 'pending', 'inactive', 'terminated'];

export function SearchAgentsModal({
  isOpen,
  onClose,
  onSelect,
  multiSelect = false,
  excludeIds = [],
  filterStates,
  title = 'Search Agents',
  description = 'Find and select agents',
  enableMultiCorp = false,
}: SearchAgentsModalProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Search/Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>(['active']);
  const [stateFilter, setStateFilter] = useState<string[]>(filterStates || []);
  const [tierFilter, setTierFilter] = useState('');

  const supabase = createClient();

  const searchAgents = useCallback(async () => {
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

      // Build query
      let query = supabase
        .from('advisors')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          status,
          license_number,
          license_states,
          commission_tier,
          organization_id
        `)
        .order('first_name');

      // Organization filter
      if (!enableMultiCorp) {
        query = query.eq('organization_id', profile.organization_id);
      }

      // Status filter
      if (statusFilter.length > 0) {
        query = query.in('status', statusFilter);
      }

      // Search filter
      if (searchQuery) {
        query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }

      // Commission tier filter
      if (tierFilter) {
        query = query.eq('commission_tier', tierFilter);
      }

      // Limit results
      query = query.limit(100);

      const { data } = await query as { data: Agent[] | null };

      if (data) {
        // Filter by state (client-side since license_states is an array)
        let filteredAgents = data;

        if (stateFilter.length > 0) {
          filteredAgents = data.filter(agent =>
            agent.license_states?.some(state => stateFilter.includes(state))
          );
        }

        // Exclude specific IDs
        if (excludeIds.length > 0) {
          filteredAgents = filteredAgents.filter(agent => !excludeIds.includes(agent.id));
        }

        setAgents(filteredAgents);
      }
    } catch (error) {
      console.error('Error searching agents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, searchQuery, statusFilter, stateFilter, tierFilter, excludeIds, enableMultiCorp]);

  useEffect(() => {
    if (isOpen) {
      searchAgents();
    }
  }, [isOpen, searchAgents]);

  useEffect(() => {
    // Reset selection when modal opens
    if (isOpen) {
      setSelectedAgents([]);
    }
  }, [isOpen]);

  const handleSelectAgent = (agent: Agent) => {
    if (multiSelect) {
      setSelectedAgents(prev => {
        const isSelected = prev.some(a => a.id === agent.id);
        if (isSelected) {
          return prev.filter(a => a.id !== agent.id);
        }
        return [...prev, agent];
      });
    } else {
      onSelect([agent]);
      onClose();
    }
  };

  const handleConfirmSelection = () => {
    onSelect(selectedAgents);
    onClose();
  };

  const toggleStatusFilter = (status: string) => {
    setStatusFilter(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const toggleStateFilter = (state: string) => {
    setStateFilter(prev =>
      prev.includes(state)
        ? prev.filter(s => s !== state)
        : [...prev, state]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter(['active']);
    setStateFilter([]);
    setTierFilter('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-slate-100' : ''}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {(stateFilter.length > 0 || tierFilter || statusFilter.length !== 1) && (
                <Badge variant="secondary" className="ml-2">
                  {stateFilter.length + (tierFilter ? 1 : 0) + (statusFilter.length !== 1 ? 1 : 0)}
                </Badge>
              )}
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="border rounded-lg p-4 space-y-4 bg-slate-50">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Filters</Label>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Status Filter */}
                <div className="space-y-2">
                  <Label className="text-sm">Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((status) => (
                      <Badge
                        key={status}
                        variant={statusFilter.includes(status) ? 'default' : 'outline'}
                        className="cursor-pointer capitalize"
                        onClick={() => toggleStatusFilter(status)}
                      >
                        {status}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Commission Tier */}
                <div className="space-y-2">
                  <Label className="text-sm">Commission Tier</Label>
                  <Input
                    placeholder="Filter by tier..."
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                  />
                </div>
              </div>

              {/* State Filter */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Licensed States
                </Label>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto border rounded p-2 bg-white">
                  {US_STATES.map((state) => (
                    <Badge
                      key={state}
                      variant={stateFilter.includes(state) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleStateFilter(state)}
                    >
                      {state}
                    </Badge>
                  ))}
                </div>
                {stateFilter.length > 0 && (
                  <p className="text-xs text-muted-foreground">{stateFilter.length} state(s) selected</p>
                )}
              </div>

              {enableMultiCorp && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Multi-organization search enabled - showing agents from all accessible organizations
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Results */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                <Users className="h-12 w-12 mb-4 opacity-50" />
                <p>No agents found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="divide-y">
                {agents.map((agent) => {
                  const isSelected = selectedAgents.some(a => a.id === agent.id);
                  return (
                    <div
                      key={agent.id}
                      onClick={() => handleSelectAgent(agent)}
                      className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-teal-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {multiSelect && (
                          <Checkbox checked={isSelected} readOnly />
                        )}
                        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-teal-700">
                            {agent.first_name?.[0]}{agent.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {agent.first_name} {agent.last_name}
                          </p>
                          <p className="text-sm text-slate-500">{agent.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {agent.license_states && agent.license_states.length > 0 && (
                          <div className="flex gap-1">
                            {agent.license_states.slice(0, 3).map((state) => (
                              <Badge key={state} variant="outline" className="text-xs">
                                {state}
                              </Badge>
                            ))}
                            {agent.license_states.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{agent.license_states.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                        <Badge
                          variant={agent.status === 'active' ? 'default' : 'secondary'}
                          className="capitalize"
                        >
                          {agent.status}
                        </Badge>
                        {isSelected && (
                          <CheckCircle2 className="h-5 w-5 text-teal-600" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Results count */}
          <div className="text-sm text-slate-500">
            {agents.length} agent(s) found
            {multiSelect && selectedAgents.length > 0 && (
              <span className="ml-2 text-teal-600">
                • {selectedAgents.length} selected
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {multiSelect && (
            <Button
              onClick={handleConfirmSelection}
              disabled={selectedAgents.length === 0}
            >
              Select {selectedAgents.length > 0 ? `(${selectedAgents.length})` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
