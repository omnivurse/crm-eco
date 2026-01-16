'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Plus,
  ExternalLink,
  Eye,
  Users,
  TrendingUp,
  Copy,
  QrCode,
  MoreHorizontal,
  Globe,
  EyeOff,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { toast } from 'sonner';

interface LandingPage {
  id: string;
  name: string;
  slug: string;
  headline: string | null;
  is_published: boolean;
  views: number;
  submissions: number;
  created_at: string;
  updated_at: string;
}

interface Stats {
  totalPages: number;
  publishedPages: number;
  totalViews: number;
  totalSubmissions: number;
}

export default function EnrollmentLinksPage() {
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPages: 0,
    publishedPages: 0,
    totalViews: 0,
    totalSubmissions: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single() as { data: { organization_id: string } | null };

    if (!profile) return;

    // Load landing pages
    const { data: pages } = await (supabase as any)
      .from('landing_pages')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (pages) {
      setLandingPages(pages);
      
      // Calculate stats
      const published = pages.filter((p: LandingPage) => p.is_published).length;
      const totalViews = pages.reduce((sum: number, p: LandingPage) => sum + (p.views || 0), 0);
      const totalSubs = pages.reduce((sum: number, p: LandingPage) => sum + (p.submissions || 0), 0);
      
      setStats({
        totalPages: pages.length,
        publishedPages: published,
        totalViews,
        totalSubmissions: totalSubs,
      });
    }

    setLoading(false);
  }

  function getPublicUrl(slug: string) {
    const baseUrl = process.env.NEXT_PUBLIC_PORTAL_URL || window.location.origin.replace('admin.', '');
    return `${baseUrl}/enroll/${slug}`;
  }

  async function copyLink(slug: string) {
    const url = getPublicUrl(slug);
    await navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  }

  async function togglePublished(page: LandingPage) {
    const { error } = await (supabase as any)
      .from('landing_pages')
      .update({ is_published: !page.is_published })
      .eq('id', page.id);

    if (error) {
      toast.error('Failed to update page');
    } else {
      toast.success(page.is_published ? 'Page unpublished' : 'Page published');
      loadData();
    }
  }

  function getConversionRate(views: number, submissions: number) {
    if (views === 0) return '0%';
    return ((submissions / views) * 100).toFixed(1) + '%';
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Enrollment Links</h1>
          <p className="text-slate-600 mt-1">
            Create and manage enrollment landing pages for agents and campaigns
          </p>
        </div>
        <Link href="/enrollment-links/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Create Landing Page
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Pages</p>
                <p className="text-2xl font-bold">{stats.totalPages}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Published</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.publishedPages}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <Eye className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Views</p>
                <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Conversions</p>
                <p className="text-2xl font-bold text-amber-600">{stats.totalSubmissions}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Landing Pages List */}
      {landingPages.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Globe className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No landing pages yet</h3>
            <p className="text-slate-600 mb-6">
              Create your first enrollment landing page to start collecting leads.
            </p>
            <Link href="/enrollment-links/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Landing Page
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {landingPages.map((page) => (
            <Card key={page.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Link 
                        href={`/enrollment-links/${page.id}`}
                        className="text-lg font-semibold text-slate-900 hover:text-blue-600"
                      >
                        {page.name}
                      </Link>
                      <Badge variant={page.is_published ? 'default' : 'secondary'}>
                        {page.is_published ? 'Published' : 'Draft'}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">
                      {page.headline || 'No headline set'}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {page.views || 0} views
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {page.submissions || 0} submissions
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        {getConversionRate(page.views || 0, page.submissions || 0)} conversion
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(page.slug)}
                      className="gap-1"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a 
                        href={getPublicUrl(page.slug)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="gap-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Preview
                      </a>
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/enrollment-links/${page.id}`}>
                            Edit Page
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/enrollment-links/${page.id}/qr`}>
                            <QrCode className="w-4 h-4 mr-2" />
                            Generate QR Code
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePublished(page)}>
                          {page.is_published ? (
                            <>
                              <EyeOff className="w-4 h-4 mr-2" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              Publish
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
