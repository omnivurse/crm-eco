'use client';

import * as React from 'react';
import { Download, FileSpreadsheet, FileJson, FileText, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './dropdown-menu';

export type ExportFormat = 'csv' | 'excel' | 'json';

export interface ExportOption {
  format: ExportFormat;
  label: string;
  description?: string;
  icon: React.ReactNode;
}

const DEFAULT_OPTIONS: ExportOption[] = [
  {
    format: 'csv',
    label: 'CSV',
    description: 'Comma-separated values',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    format: 'excel',
    label: 'Excel',
    description: 'Microsoft Excel format',
    icon: <FileSpreadsheet className="h-4 w-4" />,
  },
  {
    format: 'json',
    label: 'JSON',
    description: 'JavaScript Object Notation',
    icon: <FileJson className="h-4 w-4" />,
  },
];

export interface ExportButtonProps {
  onExport: (format: ExportFormat) => Promise<void> | void;
  options?: ExportOption[];
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  label?: string;
  showLabel?: boolean;
  align?: 'start' | 'center' | 'end';
}

export function ExportButton({
  onExport,
  options = DEFAULT_OPTIONS,
  disabled = false,
  className,
  variant = 'outline',
  size = 'default',
  label = 'Export',
  showLabel = true,
  align = 'end',
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportingFormat, setExportingFormat] = React.useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    if (isExporting || disabled) return;

    setIsExporting(true);
    setExportingFormat(format);

    try {
      await onExport(format);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || isExporting}
          className={cn('gap-2', className)}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {showLabel && <span>{isExporting ? 'Exporting...' : label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        <DropdownMenuLabel>Export as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem
            key={option.format}
            onClick={() => handleExport(option.format)}
            disabled={isExporting}
            className="flex items-center gap-3 cursor-pointer"
          >
            <span className="text-muted-foreground">
              {exportingFormat === option.format ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                option.icon
              )}
            </span>
            <div className="flex flex-col">
              <span className="font-medium">{option.label}</span>
              {option.description && (
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Simplified version for when you just need a quick export with a single format
export interface QuickExportButtonProps {
  onExport: () => Promise<void> | void;
  format?: ExportFormat;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  label?: string;
}

export function QuickExportButton({
  onExport,
  format = 'csv',
  disabled = false,
  className,
  variant = 'outline',
  size = 'default',
  label,
}: QuickExportButtonProps) {
  const [isExporting, setIsExporting] = React.useState(false);

  const formatLabels: Record<ExportFormat, string> = {
    csv: 'Export CSV',
    excel: 'Export Excel',
    json: 'Export JSON',
  };

  const handleExport = async () => {
    if (isExporting || disabled) return;

    setIsExporting(true);

    try {
      await onExport();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || isExporting}
      onClick={handleExport}
      className={cn('gap-2', className)}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      <span>{isExporting ? 'Exporting...' : label || formatLabels[format]}</span>
    </Button>
  );
}
