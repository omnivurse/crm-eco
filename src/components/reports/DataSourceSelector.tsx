import { Users, UserCheck, FileText, DollarSign, Check } from 'lucide-react';
import type { DataSource } from 'shared';

interface DataSourceOption {
  id: DataSource;
  label: string;
  description: string;
  icon: React.ReactNode;
  fieldCount: number;
  relatedTables: string[];
}

const DATA_SOURCE_OPTIONS: DataSourceOption[] = [
  {
    id: 'members',
    label: 'Members',
    description: 'Health insurance members and their enrollment info',
    icon: <Users className="w-6 h-6" />,
    fieldCount: 18,
    relatedTables: ['Advisors'],
  },
  {
    id: 'advisors',
    label: 'Advisors',
    description: 'Insurance advisors, agent levels, and hierarchy',
    icon: <UserCheck className="w-6 h-6" />,
    fieldCount: 15,
    relatedTables: ['Agent Levels', 'Upline'],
  },
  {
    id: 'enrollments',
    label: 'Enrollments',
    description: 'Member enrollments, products, and premiums',
    icon: <FileText className="w-6 h-6" />,
    fieldCount: 16,
    relatedTables: ['Members', 'Advisors', 'Products'],
  },
  {
    id: 'commissions',
    label: 'Commissions',
    description: 'Advisor commission records and payouts',
    icon: <DollarSign className="w-6 h-6" />,
    fieldCount: 14,
    relatedTables: ['Advisors', 'Members'],
  },
];

interface DataSourceSelectorProps {
  selectedSource: DataSource | null;
  onSelect: (source: DataSource) => void;
}

export function DataSourceSelector({ selectedSource, onSelect }: DataSourceSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
          Choose a Data Source
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">
          Select the primary entity for your report
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DATA_SOURCE_OPTIONS.map((option) => {
          const isSelected = selectedSource === option.id;

          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={`
                relative flex flex-col items-start p-6 rounded-xl border-2 transition-all text-left
                ${isSelected
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                }
              `}
            >
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}

              <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center mb-4
                ${isSelected
                  ? 'bg-primary-500 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }
              `}>
                {option.icon}
              </div>

              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
                {option.label}
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                {option.description}
              </p>

              <div className="flex flex-wrap gap-2 mt-auto">
                <span className="px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-md">
                  {option.fieldCount} fields
                </span>
                {option.relatedTables.map((table) => (
                  <span
                    key={table}
                    className="px-2 py-1 text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-md"
                  >
                    + {table}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
