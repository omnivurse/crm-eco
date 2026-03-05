'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  ArrowLeft,
  Save,
  Eye,
  Loader2,
  Globe,
  Lock,
} from 'lucide-react';
import { BuilderSidebar } from './BuilderSidebar';
import { BuilderCanvas } from './BuilderCanvas';
import { BuilderProperties } from './BuilderProperties';
import { PreviewModal } from './PreviewModal';
import type {
  LandingPageSection,
  SectionType,
} from '@/lib/landing-pages/types';
import { createDefaultSectionData, SECTION_TEMPLATES } from '@/lib/landing-pages/types';

interface LandingPageRecord {
  id: string;
  name: string;
  slug: string;
  is_published: boolean;
  sections: LandingPageSection[];
  headline: string | null;
  subheadline: string | null;
  primary_color: string;
  secondary_color: string;
  form_fields: string[];
  [key: string]: any;
}

interface BuilderShellProps {
  page: LandingPageRecord;
}

export function BuilderShell({ page }: BuilderShellProps) {
  const router = useRouter();
  const [sections, setSections] = useState<LandingPageSection[]>(() => {
    // If page already has sections, use them
    if (page.sections && Array.isArray(page.sections) && page.sections.length > 0) {
      return page.sections;
    }
    // Legacy migration: convert old fields to sections
    const legacy: LandingPageSection[] = [];
    if (page.headline || page.subheadline) {
      legacy.push({
        id: crypto.randomUUID(),
        type: 'hero',
        title: 'Hero',
        visible: true,
        data: {
          headline: page.headline || 'Welcome',
          subheadline: page.subheadline || '',
          backgroundImageUrl: '',
          backgroundColor: page.primary_color || '#0d9488',
          ctaText: 'Get Started',
          ctaLink: '#form',
          layout: 'centered' as const,
        },
      });
    }
    if (page.form_fields && page.form_fields.length > 0) {
      legacy.push({
        id: crypto.randomUUID(),
        type: 'form',
        title: 'Request a Quote',
        visible: true,
        data: {
          title: 'Request a Quote',
          description: '',
          fields: page.form_fields.map((f: string) => ({
            id: crypto.randomUUID(),
            type: 'text' as const,
            label: f.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
            placeholder: '',
            required: true,
          })),
          submitButtonText: 'Submit',
          successMessage: 'Thank you for your submission!',
        },
      });
    }
    return legacy;
  });

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Auto-save debounce
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await supabase
        .from('landing_pages')
        .update({ sections: sectionsRef.current })
        .eq('id', page.id);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  }, [page.id]);

  // Auto-save on section changes
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      save();
    }, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [sections, save]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSections((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleAddSection = (type: SectionType) => {
    const template = SECTION_TEMPLATES.find((t) => t.type === type);
    const newSection: LandingPageSection = {
      id: crypto.randomUUID(),
      type,
      title: template?.label || type,
      data: createDefaultSectionData(type),
      visible: true,
    };
    setSections((prev) => [...prev, newSection]);
    setSelectedSectionId(newSection.id);
  };

  const handleDeleteSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
    if (selectedSectionId === id) setSelectedSectionId(null);
  };

  const handleToggleVisibility = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)),
    );
  };

  const handleUpdateSection = (id: string, updates: Partial<LandingPageSection>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
  };

  const handleTogglePublish = async () => {
    const newPublished = !page.is_published;
    await supabase
      .from('landing_pages')
      .update({
        is_published: newPublished,
        published_at: newPublished ? new Date().toISOString() : page.published_at,
        sections: sectionsRef.current,
      })
      .eq('id', page.id);
    router.refresh();
  };

  const selectedSection = sections.find((s) => s.id === selectedSectionId) || null;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top toolbar */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/crm/settings/landing-pages')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="h-5 w-px bg-slate-200 dark:bg-white/10" />
          <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
            {page.name}
          </h1>
          {lastSaved && (
            <span className="text-[11px] text-slate-400">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="w-4 h-4 mr-1" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
          <Button
            size="sm"
            variant={page.is_published ? 'outline' : 'default'}
            onClick={handleTogglePublish}
            className={page.is_published ? 'text-amber-600 border-amber-300' : ''}
          >
            {page.is_published ? (
              <>
                <Lock className="w-4 h-4 mr-1" />
                Unpublish
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 mr-1" />
                Publish
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex-1 flex min-h-0">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <BuilderSidebar
            sections={sections}
            selectedSectionId={selectedSectionId}
            onSelectSection={setSelectedSectionId}
            onAddSection={handleAddSection}
            onToggleVisibility={handleToggleVisibility}
            onDeleteSection={handleDeleteSection}
          />

          <BuilderCanvas
            sections={sections}
            selectedSectionId={selectedSectionId}
            onSelectSection={setSelectedSectionId}
          />
        </DndContext>

        <BuilderProperties
          section={selectedSection}
          onUpdateSection={handleUpdateSection}
          onClose={() => setSelectedSectionId(null)}
        />
      </div>

      {/* Preview Modal */}
      <PreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        sections={sections}
        pageName={page.name}
      />
    </div>
  );
}
