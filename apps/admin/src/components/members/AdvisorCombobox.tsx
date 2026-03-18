'use client';

import { Combobox, type ComboboxOption } from '@crm-eco/ui';

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface AdvisorComboboxProps {
  agents: Agent[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  label?: 'advisor' | 'agent';
}

export function AdvisorCombobox({
  agents,
  value,
  onValueChange,
  disabled = false,
  label = 'advisor',
}: AdvisorComboboxProps) {
  const options: ComboboxOption[] = agents.map((agent) => ({
    value: agent.id,
    label: `${agent.first_name} ${agent.last_name}`,
    subtext: agent.email,
  }));

  const labelText = label === 'advisor' ? 'Advisor' : 'Agent';

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={`Choose an ${labelText}`}
      searchPlaceholder={`Search by name...`}
      emptyText={`No ${labelText.toLowerCase()}s found.`}
      disabled={disabled}
      clearable
      triggerClassName="h-11 sm:h-10"
    />
  );
}
