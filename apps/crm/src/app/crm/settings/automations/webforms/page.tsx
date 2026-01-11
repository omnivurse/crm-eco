'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { Switch } from '@crm-eco/ui/components/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import { Badge } from '@crm-eco/ui/components/badge';
import { Input } from '@crm-eco/ui/components/input';
import {
  FileText,
  Plus,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Copy,
  ExternalLink,
  Code,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import type { CrmWebform } from '@/lib/automation/types';

export default function WebformsPage() {
  const [webforms, setWebforms] = useState<CrmWebform[]>([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchWebforms();
  }, []);

  async function fetchWebforms() {
    try {
      const res = await fetch('/api/crm/modules');
      const modulesData = await res.json();
      const moduleMap: Record<string, string> = {};
      modulesData.forEach((m: { id: string; name: string }) => {
        moduleMap[m.id] = m.name;
      });
      setModules(moduleMap);
      setWebforms([]);
    } catch (error) {
      console.error('Failed to fetch webforms:', error);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/settings/automations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Webforms</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Create public forms for lead capture
              </p>
            </div>
          </div>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create Webform
        </Button>
      </div>

      {/* How it works */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          How Webforms Work
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900 dark:text-white">1. Create Form</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Design your form with fields from your CRM module
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Code className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900 dark:text-white">2. Embed</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Copy the embed code or share the direct URL
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <ExternalLink className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900 dark:text-white">3. Capture Leads</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Submissions create records and trigger workflows
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Webforms Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : webforms.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No webforms yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create public forms to capture leads from your website
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Webform
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webforms.map((webform) => (
                <TableRow key={webform.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {webform.name}
                      </div>
                      {webform.description && (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {webform.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {modules[webform.module_id] || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        /{webform.slug}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(webform.slug)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-600 dark:text-slate-400">
                      {webform.submit_count.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Switch checked={webform.is_enabled} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Code className="w-4 h-4 mr-2" />
                          Get Embed Code
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
