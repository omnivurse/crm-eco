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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@crm-eco/ui';
import {
  FileText,
  Building2,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Calendar,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface License {
  id: string;
  state_code: string;
  license_number: string;
  license_type: string;
  issue_date: string | null;
  expiration_date: string | null;
  status: string;
  ce_hours_required: number | null;
  ce_hours_completed: number;
  ce_due_date: string | null;
  notes: string | null;
}

interface Appointment {
  id: string;
  carrier_name: string;
  carrier_code: string | null;
  appointment_number: string | null;
  appointment_type: string;
  states: string[];
  products: string[];
  effective_date: string | null;
  termination_date: string | null;
  status: string;
  commission_level: string | null;
  notes: string | null;
}

interface AgentLicensingTabProps {
  agentId: string;
  organizationId: string;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

const LICENSE_TYPES = [
  { value: 'life_health', label: 'Life & Health' },
  { value: 'property_casualty', label: 'Property & Casualty' },
  { value: 'life_only', label: 'Life Only' },
  { value: 'health_only', label: 'Health Only' },
  { value: 'variable', label: 'Variable' },
  { value: 'other', label: 'Other' },
];

const APPOINTMENT_TYPES = [
  { value: 'writing', label: 'Writing' },
  { value: 'servicing', label: 'Servicing' },
  { value: 'both', label: 'Writing & Servicing' },
];

export function AgentLicensingTab({ agentId, organizationId }: AgentLicensingTabProps) {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // License form state
  const [licenseForm, setLicenseForm] = useState({
    state_code: '',
    license_number: '',
    license_type: 'life_health',
    issue_date: '',
    expiration_date: '',
    status: 'active',
    ce_hours_required: '',
    ce_hours_completed: '',
    ce_due_date: '',
    notes: '',
  });

  // Appointment form state
  const [appointmentForm, setAppointmentForm] = useState({
    carrier_name: '',
    carrier_code: '',
    appointment_number: '',
    appointment_type: 'writing',
    states: [] as string[],
    products: [] as string[],
    effective_date: '',
    termination_date: '',
    status: 'active',
    commission_level: '',
    notes: '',
  });

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load licenses
      const { data: licensesData } = await supabase
        .from('agent_licenses')
        .select('*')
        .eq('advisor_id', agentId)
        .order('state_code') as { data: License[] | null };

      if (licensesData) {
        setLicenses(licensesData);
      }

      // Load appointments
      const { data: appointmentsData } = await supabase
        .from('agent_appointments')
        .select('*')
        .eq('advisor_id', agentId)
        .order('carrier_name') as { data: Appointment[] | null };

      if (appointmentsData) {
        setAppointments(appointmentsData);
      }
    } catch (error) {
      console.error('Error loading licensing data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, agentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddLicense = () => {
    setSelectedLicense(null);
    setLicenseForm({
      state_code: '',
      license_number: '',
      license_type: 'life_health',
      issue_date: '',
      expiration_date: '',
      status: 'active',
      ce_hours_required: '',
      ce_hours_completed: '',
      ce_due_date: '',
      notes: '',
    });
    setIsLicenseModalOpen(true);
  };

  const handleEditLicense = (license: License) => {
    setSelectedLicense(license);
    setLicenseForm({
      state_code: license.state_code,
      license_number: license.license_number,
      license_type: license.license_type,
      issue_date: license.issue_date || '',
      expiration_date: license.expiration_date || '',
      status: license.status,
      ce_hours_required: license.ce_hours_required?.toString() || '',
      ce_hours_completed: license.ce_hours_completed?.toString() || '',
      ce_due_date: license.ce_due_date || '',
      notes: license.notes || '',
    });
    setIsLicenseModalOpen(true);
  };

  const handleSaveLicense = async () => {
    setIsSaving(true);
    try {
      const data = {
        organization_id: organizationId,
        advisor_id: agentId,
        state_code: licenseForm.state_code,
        license_number: licenseForm.license_number,
        license_type: licenseForm.license_type,
        issue_date: licenseForm.issue_date || null,
        expiration_date: licenseForm.expiration_date || null,
        status: licenseForm.status,
        ce_hours_required: licenseForm.ce_hours_required ? parseInt(licenseForm.ce_hours_required) : null,
        ce_hours_completed: licenseForm.ce_hours_completed ? parseInt(licenseForm.ce_hours_completed) : 0,
        ce_due_date: licenseForm.ce_due_date || null,
        notes: licenseForm.notes || null,
      };

      if (selectedLicense) {
        const { error } = await (supabase as any)
          .from('agent_licenses')
          .update(data)
          .eq('id', selectedLicense.id);
        if (error) throw error;
        toast.success('License updated successfully');
      } else {
        const { error } = await (supabase as any)
          .from('agent_licenses')
          .insert(data);
        if (error) throw error;
        toast.success('License added successfully');
      }

      setIsLicenseModalOpen(false);
      loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to save license: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLicense = async (license: License) => {
    if (!confirm('Are you sure you want to delete this license?')) return;

    try {
      const { error } = await supabase
        .from('agent_licenses')
        .delete()
        .eq('id', license.id);
      if (error) throw error;
      toast.success('License deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete license');
    }
  };

  const handleAddAppointment = () => {
    setSelectedAppointment(null);
    setAppointmentForm({
      carrier_name: '',
      carrier_code: '',
      appointment_number: '',
      appointment_type: 'writing',
      states: [],
      products: [],
      effective_date: '',
      termination_date: '',
      status: 'active',
      commission_level: '',
      notes: '',
    });
    setIsAppointmentModalOpen(true);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setAppointmentForm({
      carrier_name: appointment.carrier_name,
      carrier_code: appointment.carrier_code || '',
      appointment_number: appointment.appointment_number || '',
      appointment_type: appointment.appointment_type,
      states: appointment.states || [],
      products: appointment.products || [],
      effective_date: appointment.effective_date || '',
      termination_date: appointment.termination_date || '',
      status: appointment.status,
      commission_level: appointment.commission_level || '',
      notes: appointment.notes || '',
    });
    setIsAppointmentModalOpen(true);
  };

  const handleSaveAppointment = async () => {
    setIsSaving(true);
    try {
      const data = {
        organization_id: organizationId,
        advisor_id: agentId,
        carrier_name: appointmentForm.carrier_name,
        carrier_code: appointmentForm.carrier_code || null,
        appointment_number: appointmentForm.appointment_number || null,
        appointment_type: appointmentForm.appointment_type,
        states: appointmentForm.states,
        products: appointmentForm.products,
        effective_date: appointmentForm.effective_date || null,
        termination_date: appointmentForm.termination_date || null,
        status: appointmentForm.status,
        commission_level: appointmentForm.commission_level || null,
        notes: appointmentForm.notes || null,
      };

      if (selectedAppointment) {
        const { error } = await (supabase as any)
          .from('agent_appointments')
          .update(data)
          .eq('id', selectedAppointment.id);
        if (error) throw error;
        toast.success('Appointment updated successfully');
      } else {
        const { error } = await (supabase as any)
          .from('agent_appointments')
          .insert(data);
        if (error) throw error;
        toast.success('Appointment added successfully');
      }

      setIsAppointmentModalOpen(false);
      loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to save appointment: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAppointment = async (appointment: Appointment) => {
    if (!confirm('Are you sure you want to delete this appointment?')) return;

    try {
      const { error } = await supabase
        .from('agent_appointments')
        .delete()
        .eq('id', appointment.id);
      if (error) throw error;
      toast.success('Appointment deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete appointment');
    }
  };

  const toggleStateSelection = (state: string) => {
    setAppointmentForm(prev => ({
      ...prev,
      states: prev.states.includes(state)
        ? prev.states.filter(s => s !== state)
        : [...prev.states, state]
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'expired':
      case 'terminated':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-slate-400" />;
    }
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
      {/* Licenses Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Licenses
              </CardTitle>
              <CardDescription>{licenses.length} license(s) on file</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button onClick={handleAddLicense}>
                <Plus className="h-4 w-4 mr-2" />
                Add License
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {licenses.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No licenses on file</p>
              <Button variant="link" onClick={handleAddLicense}>
                Add the first license
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">State</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">License #</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Expiration</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">CE Progress</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {licenses.map((license) => (
                    <tr key={license.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Badge variant="outline">{license.state_code}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">{license.license_number}</td>
                      <td className="px-4 py-3 text-sm">
                        {LICENSE_TYPES.find(t => t.value === license.license_type)?.label || license.license_type}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {license.expiration_date ? (
                          <span className={new Date(license.expiration_date) < new Date() ? 'text-red-600' : ''}>
                            {format(new Date(license.expiration_date), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {license.ce_hours_required ? (
                          <span>
                            {license.ce_hours_completed}/{license.ce_hours_required} hrs
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(license.status)}
                          <span className="text-sm capitalize">{license.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEditLicense(license)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteLicense(license)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appointments Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Carrier Appointments
              </CardTitle>
              <CardDescription>{appointments.length} appointment(s) on file</CardDescription>
            </div>
            <Button onClick={handleAddAppointment}>
              <Plus className="h-4 w-4 mr-2" />
              Add Appointment
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No carrier appointments on file</p>
              <Button variant="link" onClick={handleAddAppointment}>
                Add the first appointment
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Carrier</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">States</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Effective</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Level</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{appointment.carrier_name}</p>
                        {appointment.carrier_code && (
                          <p className="text-xs text-slate-500">{appointment.carrier_code}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm capitalize">{appointment.appointment_type}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {appointment.states.slice(0, 3).map((state) => (
                            <Badge key={state} variant="outline" className="text-xs">
                              {state}
                            </Badge>
                          ))}
                          {appointment.states.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{appointment.states.length - 3}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {appointment.effective_date
                          ? format(new Date(appointment.effective_date), 'MMM d, yyyy')
                          : <span className="text-slate-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {appointment.commission_level || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(appointment.status)}
                          <span className="text-sm capitalize">{appointment.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEditAppointment(appointment)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteAppointment(appointment)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* License Modal */}
      <Dialog open={isLicenseModalOpen} onOpenChange={setIsLicenseModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedLicense ? 'Edit License' : 'Add License'}</DialogTitle>
            <DialogDescription>Enter the license information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>State</Label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={licenseForm.state_code}
                  onChange={(e) => setLicenseForm({ ...licenseForm, state_code: e.target.value })}
                >
                  <option value="">Select state...</option>
                  {US_STATES.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>License Number</Label>
                <Input
                  value={licenseForm.license_number}
                  onChange={(e) => setLicenseForm({ ...licenseForm, license_number: e.target.value })}
                  placeholder="License #"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>License Type</Label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={licenseForm.license_type}
                  onChange={(e) => setLicenseForm({ ...licenseForm, license_type: e.target.value })}
                >
                  {LICENSE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={licenseForm.status}
                  onChange={(e) => setLicenseForm({ ...licenseForm, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="expired">Expired</option>
                  <option value="suspended">Suspended</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={licenseForm.issue_date}
                  onChange={(e) => setLicenseForm({ ...licenseForm, issue_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiration Date</Label>
                <Input
                  type="date"
                  value={licenseForm.expiration_date}
                  onChange={(e) => setLicenseForm({ ...licenseForm, expiration_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>CE Hours Required</Label>
                <Input
                  type="number"
                  value={licenseForm.ce_hours_required}
                  onChange={(e) => setLicenseForm({ ...licenseForm, ce_hours_required: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>CE Hours Completed</Label>
                <Input
                  type="number"
                  value={licenseForm.ce_hours_completed}
                  onChange={(e) => setLicenseForm({ ...licenseForm, ce_hours_completed: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>CE Due Date</Label>
                <Input
                  type="date"
                  value={licenseForm.ce_due_date}
                  onChange={(e) => setLicenseForm({ ...licenseForm, ce_due_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={licenseForm.notes}
                onChange={(e) => setLicenseForm({ ...licenseForm, notes: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLicenseModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveLicense} disabled={isSaving || !licenseForm.state_code || !licenseForm.license_number}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedLicense ? 'Update' : 'Add'} License
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Modal */}
      <Dialog open={isAppointmentModalOpen} onOpenChange={setIsAppointmentModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedAppointment ? 'Edit Appointment' : 'Add Appointment'}</DialogTitle>
            <DialogDescription>Enter the carrier appointment information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Carrier Name</Label>
                <Input
                  value={appointmentForm.carrier_name}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, carrier_name: e.target.value })}
                  placeholder="Carrier name"
                />
              </div>
              <div className="space-y-2">
                <Label>Carrier Code</Label>
                <Input
                  value={appointmentForm.carrier_code}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, carrier_code: e.target.value })}
                  placeholder="Optional code"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Appointment Type</Label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={appointmentForm.appointment_type}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, appointment_type: e.target.value })}
                >
                  {APPOINTMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={appointmentForm.status}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="terminated">Terminated</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>States</Label>
              <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {US_STATES.map((state) => (
                    <Badge
                      key={state}
                      variant={appointmentForm.states.includes(state) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleStateSelection(state)}
                    >
                      {state}
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{appointmentForm.states.length} state(s) selected</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Effective Date</Label>
                <Input
                  type="date"
                  value={appointmentForm.effective_date}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, effective_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Commission Level</Label>
                <Input
                  value={appointmentForm.commission_level}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, commission_level: e.target.value })}
                  placeholder="e.g., Level 1, Gold"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Appointment Number</Label>
              <Input
                value={appointmentForm.appointment_number}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, appointment_number: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={appointmentForm.notes}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAppointmentModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAppointment} disabled={isSaving || !appointmentForm.carrier_name}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedAppointment ? 'Update' : 'Add'} Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Licenses & Appointments</DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk import license and appointment data
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-slate-400 mb-4" />
              <p className="text-sm text-slate-600 mb-2">
                Drag and drop a CSV file here, or click to browse
              </p>
              <Button variant="outline">Select File</Button>
            </div>
            <div className="text-sm text-slate-500">
              <p className="font-medium mb-2">CSV Format:</p>
              <p>For Licenses: state_code, license_number, license_type, issue_date, expiration_date</p>
              <p>For Appointments: carrier_name, carrier_code, states (comma-separated), effective_date</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportModalOpen(false)}>Cancel</Button>
            <Button disabled>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
