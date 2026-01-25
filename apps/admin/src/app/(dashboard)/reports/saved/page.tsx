'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Search,
  Star,
  Clock,
  Play,
  MoreVertical,
  Trash2,
  Edit,
  FileText,
  Plus,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';

interface SavedReport {
  id: string;
  name: string;
  description?: string;
  data_source: string;
  template_category?: string;
  run_count?: number;
  last_run_at?: string;
  is_favorite?: boolean;
  created_at: string;
}

export default function AdminSavedReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch('/api/reports');
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || []);
        }
      } catch (error) {
        console.error('Failed to fetch reports:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchReports();
  }, []);

  const handleToggleFavorite = async (reportId: string) => {
    try {
      await fetch(`/api/reports/${reportId}/favorite`, { method: 'PATCH' });
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, is_favorite: !r.is_favorite } : r))
      );
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
      }
    } catch (error) {
      console.error('Failed to delete report:', error);
    }
  };

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      filterCategory === 'all' || report.template_category === filterCategory;
    const matchesFavorite = !showFavoritesOnly || report.is_favorite;
    return matchesSearch && matchesCategory && matchesFavorite;
  });

  const categories = Array.from(
    new Set(reports.map((r) => r.template_category).filter(Boolean))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Link
            href="/reports"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Saved Reports</h1>
          <p className="text-slate-600 mt-0.5">
            Manage your saved reports and run history
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/reports/new">
            <Button className="bg-[#047474] hover:bg-[#035f5f] text-white">
              <Plus className="w-4 h-4 mr-2" />
              New Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat || ''}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={showFavoritesOnly ? 'default' : 'outline'}
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={showFavoritesOnly ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
        >
          <Star className={`w-4 h-4 mr-2 ${showFavoritesOnly ? 'fill-current' : ''}`} />
          Favorites
        </Button>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-4 border border-slate-200 animate-pulse"
            >
              <div className="h-6 w-48 bg-slate-200 rounded mb-2" />
              <div className="h-4 w-64 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : filteredReports.length > 0 ? (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-xl p-4 border border-slate-200 hover:border-[#047474]/20 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/reports/saved/${report.id}`}
                      className="text-lg font-semibold text-slate-900 hover:text-[#047474] transition-colors truncate"
                    >
                      {report.name}
                    </Link>
                    {report.is_favorite && (
                      <Star className="w-4 h-4 text-amber-500 fill-current flex-shrink-0" />
                    )}
                  </div>
                  {report.description && (
                    <p className="text-sm text-slate-500 line-clamp-1 mb-2">
                      {report.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {report.data_source}
                    </span>
                    {report.template_category && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100">
                        {report.template_category}
                      </span>
                    )}
                    {report.run_count !== undefined && (
                      <span className="flex items-center gap-1">
                        <Play className="w-3 h-3" />
                        {report.run_count} runs
                      </span>
                    )}
                    {report.last_run_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last run {new Date(report.last_run_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleFavorite(report.id)}
                    className={report.is_favorite ? 'text-amber-500' : ''}
                  >
                    <Star className={`w-4 h-4 ${report.is_favorite ? 'fill-current' : ''}`} />
                  </Button>
                  <Link href={`/reports/saved/${report.id}?run=true`}>
                    <Button size="sm" className="bg-[#047474] hover:bg-[#035f5f] text-white">
                      <Play className="w-4 h-4 mr-1" />
                      Run
                    </Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/reports/saved/${report.id}`}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteReport(report.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            {searchQuery || filterCategory !== 'all' || showFavoritesOnly
              ? 'No matching reports'
              : 'No saved reports yet'}
          </h3>
          <p className="text-slate-500 mb-4">
            {searchQuery || filterCategory !== 'all' || showFavoritesOnly
              ? 'Try adjusting your filters'
              : 'Create your first report from a template'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/reports/templates">
              <Button variant="outline">Browse Templates</Button>
            </Link>
            <Link href="/reports/new">
              <Button className="bg-[#047474] hover:bg-[#035f5f] text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create Report
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
