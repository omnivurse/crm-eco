'use client';

import { useState, useRef } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import {
  Link as LinkIcon,
  Copy,
  ExternalLink,
  Download,
  RefreshCw,
  Eye,
  Users,
  TrendingUp,
  Palette,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { toast } from 'sonner';

interface AgentEnrollmentTabProps {
  agent: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    enrollment_code: string | null;
    primary_color: string | null;
    logo_url: string | null;
  };
  stats?: {
    totalMembers: number;
    totalEnrollments: number;
    monthlyEnrollments: number;
  };
  onUpdate?: () => void;
}

export function AgentEnrollmentTab({ agent, stats, onUpdate }: AgentEnrollmentTabProps) {
  const supabase = createClient();
  const qrRef = useRef<HTMLDivElement>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [qrColor, setQrColor] = useState(agent.primary_color || '#0d9488');

  function getEnrollmentUrl() {
    if (!agent.enrollment_code) return '';
    const baseUrl = process.env.NEXT_PUBLIC_PORTAL_URL || window.location.origin.replace('admin.', '');
    return `${baseUrl}/enroll?agent=${agent.enrollment_code}`;
  }

  async function copyLink() {
    const url = getEnrollmentUrl();
    if (url) {
      await navigator.clipboard.writeText(url);
      toast.success('Enrollment link copied to clipboard');
    }
  }

  async function regenerateCode() {
    setRegenerating(true);

    try {
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      const { error } = await (supabase as any)
        .from('advisors')
        .update({ enrollment_code: newCode })
        .eq('id', agent.id);

      if (error) throw error;

      toast.success('Enrollment code regenerated');
      onUpdate?.();
    } catch (error) {
      console.error('Error regenerating code:', error);
      toast.error('Failed to regenerate code');
    } finally {
      setRegenerating(false);
    }
  }

  function downloadQR(format: 'svg' | 'png') {
    if (!qrRef.current || !agent.enrollment_code) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const agentName = `${agent.first_name || ''}-${agent.last_name || ''}`.toLowerCase().replace(/\s+/g, '-');

    if (format === 'svg') {
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-agent-${agentName}.svg`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 512;
      canvas.height = 512;

      const img = new Image();
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `qr-agent-${agentName}.png`;
        link.click();
        URL.revokeObjectURL(url);
      };

      img.src = url;
    }

    toast.success(`QR code downloaded as ${format.toUpperCase()}`);
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Members</p>
                  <p className="text-2xl font-bold">{stats.totalMembers}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Enrollments</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.totalEnrollments}</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">This Month</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.monthlyEnrollments}</p>
                </div>
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Eye className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Enrollment Code & Link */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Enrollment Link
            </CardTitle>
            <CardDescription>
              Unique enrollment link for this agent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Enrollment Code</Label>
              <div className="flex items-center gap-2 mt-1">
                {agent.enrollment_code ? (
                  <code className="flex-1 px-3 py-2 bg-slate-100 rounded-md text-lg font-mono tracking-widest">
                    {agent.enrollment_code}
                  </code>
                ) : (
                  <span className="flex-1 px-3 py-2 bg-slate-100 rounded-md text-slate-400">
                    No code generated
                  </span>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={regenerateCode}
                  disabled={regenerating}
                  title="Regenerate code"
                >
                  <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {agent.enrollment_code && (
              <div>
                <Label>Enrollment URL</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={getEnrollmentUrl()}
                    readOnly
                    className="flex-1 bg-slate-50 text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={copyLink}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" asChild>
                    <a href={getEnrollmentUrl()} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR Code */}
        <Card>
          <CardHeader>
            <CardTitle>QR Code</CardTitle>
            <CardDescription>
              Scannable QR code for the enrollment link
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {agent.enrollment_code ? (
              <>
                <div className="flex justify-center" ref={qrRef}>
                  <div className="p-4 bg-white rounded-lg border">
                    <QRCodeSVG
                      value={getEnrollmentUrl()}
                      size={180}
                      fgColor={qrColor}
                      bgColor="#ffffff"
                      level="M"
                      includeMargin
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-slate-400" />
                    <Input
                      type="color"
                      value={qrColor}
                      onChange={(e) => setQrColor(e.target.value)}
                      className="w-10 h-8 p-0.5 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => downloadQR('svg')}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    SVG
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => downloadQR('png')}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    PNG
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-slate-500">
                Generate an enrollment code first
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-slate-600">
            <li>Share the enrollment link or QR code with potential members</li>
            <li>When they visit the link, they'll be directed to the enrollment form</li>
            <li>Their enrollment will be automatically attributed to this agent</li>
            <li>Commissions will be tracked based on this agent's tier</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
