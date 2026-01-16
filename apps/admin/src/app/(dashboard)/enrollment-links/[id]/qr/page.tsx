'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Download,
  Copy,
  ExternalLink,
  Palette,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';

interface LandingPage {
  id: string;
  name: string;
  slug: string;
  primary_color: string;
}

export default function QRCodePage() {
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();
  const qrRef = useRef<HTMLDivElement>(null);
  
  const [landingPage, setLandingPage] = useState<LandingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrSettings, setQrSettings] = useState({
    size: 256,
    fgColor: '#000000',
    bgColor: '#ffffff',
    includeMargin: true,
    level: 'M' as 'L' | 'M' | 'Q' | 'H',
  });

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    const { data: page } = await (supabase as any)
      .from('landing_pages')
      .select('id, name, slug, primary_color')
      .eq('id', id)
      .single();

    if (page) {
      setLandingPage(page);
      // Use the landing page's primary color as the default QR color
      setQrSettings(prev => ({ ...prev, fgColor: page.primary_color }));
    }

    setLoading(false);
  }

  function getEnrollmentUrl() {
    if (!landingPage) return '';
    const baseUrl = process.env.NEXT_PUBLIC_PORTAL_URL || window.location.origin.replace('admin.', '');
    return `${baseUrl}/enroll/${landingPage.slug}`;
  }

  async function copyLink() {
    await navigator.clipboard.writeText(getEnrollmentUrl());
    toast.success('Link copied to clipboard');
  }

  function downloadQR(format: 'svg' | 'png') {
    if (!qrRef.current || !landingPage) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    if (format === 'svg') {
      // Download as SVG
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-${landingPage.slug}.svg`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      // Download as PNG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = qrSettings.size * 2; // Higher resolution
      canvas.height = qrSettings.size * 2;

      const img = new Image();
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.fillStyle = qrSettings.bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `qr-${landingPage.slug}.png`;
        link.click();
        URL.revokeObjectURL(url);
      };

      img.src = url;
    }

    toast.success(`QR code downloaded as ${format.toUpperCase()}`);
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!landingPage) {
    return <div className="p-8">Landing page not found</div>;
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/enrollment-links/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">QR Code: {landingPage.name}</h1>
          <p className="text-slate-600">Generate and customize a QR code for your enrollment link</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* QR Code Preview */}
        <Card>
          <CardHeader>
            <CardTitle>QR Code Preview</CardTitle>
            <CardDescription>Scan to test the enrollment link</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <div 
              ref={qrRef}
              className="p-4 rounded-lg"
              style={{ backgroundColor: qrSettings.bgColor }}
            >
              <QRCodeSVG
                value={getEnrollmentUrl()}
                size={qrSettings.size}
                fgColor={qrSettings.fgColor}
                bgColor={qrSettings.bgColor}
                level={qrSettings.level}
                includeMargin={qrSettings.includeMargin}
              />
            </div>

            <div className="flex items-center gap-2 w-full">
              <Input
                value={getEnrollmentUrl()}
                readOnly
                className="flex-1 bg-slate-50"
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

            <div className="flex gap-2 w-full">
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={() => downloadQR('svg')}
              >
                <Download className="w-4 h-4" />
                Download SVG
              </Button>
              <Button 
                className="flex-1 gap-2"
                onClick={() => downloadQR('png')}
              >
                <Download className="w-4 h-4" />
                Download PNG
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Customize
            </CardTitle>
            <CardDescription>Adjust the appearance of your QR code</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>Size</Label>
              <Select
                value={qrSettings.size.toString()}
                onValueChange={(value) => setQrSettings(prev => ({ ...prev, size: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="128">Small (128px)</SelectItem>
                  <SelectItem value="256">Medium (256px)</SelectItem>
                  <SelectItem value="384">Large (384px)</SelectItem>
                  <SelectItem value="512">Extra Large (512px)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Error Correction Level</Label>
              <Select
                value={qrSettings.level}
                onValueChange={(value) => setQrSettings(prev => ({ ...prev, level: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Low (~7% correction)</SelectItem>
                  <SelectItem value="M">Medium (~15% correction)</SelectItem>
                  <SelectItem value="Q">Quartile (~25% correction)</SelectItem>
                  <SelectItem value="H">High (~30% correction)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-slate-500 mt-1">
                Higher levels allow for more damage tolerance but result in denser codes
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Foreground Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={qrSettings.fgColor}
                    onChange={(e) => setQrSettings(prev => ({ ...prev, fgColor: e.target.value }))}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={qrSettings.fgColor}
                    onChange={(e) => setQrSettings(prev => ({ ...prev, fgColor: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label>Background Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={qrSettings.bgColor}
                    onChange={(e) => setQrSettings(prev => ({ ...prev, bgColor: e.target.value }))}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={qrSettings.bgColor}
                    onChange={(e) => setQrSettings(prev => ({ ...prev, bgColor: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Label>Quick Presets</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQrSettings(prev => ({ ...prev, fgColor: '#000000', bgColor: '#ffffff' }))}
                >
                  Classic
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQrSettings(prev => ({ ...prev, fgColor: landingPage.primary_color, bgColor: '#ffffff' }))}
                >
                  Brand Color
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQrSettings(prev => ({ ...prev, fgColor: '#ffffff', bgColor: '#000000' }))}
                >
                  Inverted
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQrSettings(prev => ({ ...prev, fgColor: '#0d9488', bgColor: '#f0fdfa' }))}
                >
                  Teal
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQrSettings(prev => ({ ...prev, fgColor: '#4f46e5', bgColor: '#eef2ff' }))}
                >
                  Indigo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-slate-600">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500">•</span>
              <span>Use SVG format for print materials to ensure crisp quality at any size</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500">•</span>
              <span>PNG format is best for digital use like social media or websites</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500">•</span>
              <span>Higher error correction levels are recommended for printed materials that may get damaged</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500">•</span>
              <span>Ensure sufficient contrast between foreground and background colors for reliable scanning</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500">•</span>
              <span>Test the QR code with multiple devices before printing</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
