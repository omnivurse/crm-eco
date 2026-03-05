'use client';

import { cn } from '@crm-eco/ui/lib/utils';
import {
  Layout,
  FileText,
  Grid3X3,
  ClipboardList,
  DollarSign,
  MessageCircle,
  Zap,
  HelpCircle,
  Code,
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SectionType, LandingPageSection, SectionTemplate } from '@/lib/landing-pages/types';
import { SECTION_TEMPLATES } from '@/lib/landing-pages/types';
import { useState } from 'react';

// Icon mapping for section types
const sectionIcons: Record<string, LucideIcon> = {
  'layout': Layout,
  'file-text': FileText,
  'grid': Grid3X3,
  'clipboard': ClipboardList,
  'dollar-sign': DollarSign,
  'message-circle': MessageCircle,
  'zap': Zap,
  'help-circle': HelpCircle,
  'code': Code,
};

function getSectionIcon(iconName: string): LucideIcon {
  return sectionIcons[iconName] || FileText;
}

// ── Palette Card (click to add) ────────────────────────────────
function PaletteCard({
  template,
  onAdd,
}: {
  template: SectionTemplate;
  onAdd: (type: SectionType) => void;
}) {
  const Icon = getSectionIcon(template.icon);
  return (
    <button
      onClick={() => onAdd(template.type)}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left text-sm hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group"
    >
      <div className="p-1.5 rounded-md bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 group-hover:bg-teal-100 dark:group-hover:bg-teal-500/20 transition-colors">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-700 dark:text-slate-300 truncate">{template.label}</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{template.description}</p>
      </div>
    </button>
  );
}

// ── Sortable Section Item ──────────────────────────────────────
function SortableSectionItem({
  section,
  isSelected,
  onSelect,
  onToggleVisibility,
  onDelete,
}: {
  section: LandingPageSection;
  isSelected: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const template = SECTION_TEMPLATES.find((t) => t.type === section.type);
  const Icon = getSectionIcon(template?.icon || 'file-text');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all cursor-pointer',
        isDragging && 'opacity-50',
        isSelected
          ? 'bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30'
          : 'hover:bg-slate-100 dark:hover:bg-white/5'
      )}
      onClick={onSelect}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <Icon className="w-3.5 h-3.5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
      <span className={cn(
        'flex-1 truncate',
        !section.visible && 'text-slate-400 dark:text-slate-500 line-through',
        section.visible && 'text-slate-700 dark:text-slate-300',
      )}>
        {section.title}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
        title={section.visible ? 'Hide section' : 'Show section'}
      >
        {section.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="text-slate-400 hover:text-red-500 flex-shrink-0"
        title="Delete section"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Main Sidebar ───────────────────────────────────────────────
interface BuilderSidebarProps {
  sections: LandingPageSection[];
  selectedSectionId: string | null;
  onSelectSection: (id: string) => void;
  onAddSection: (type: SectionType) => void;
  onToggleVisibility: (id: string) => void;
  onDeleteSection: (id: string) => void;
}

export function BuilderSidebar({
  sections,
  selectedSectionId,
  onSelectSection,
  onAddSection,
  onToggleVisibility,
  onDeleteSection,
}: BuilderSidebarProps) {
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(true);

  return (
    <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
      {/* Add Sections palette */}
      <div className="border-b border-slate-200 dark:border-white/10">
        <button
          className="flex items-center gap-2 w-full px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-white/5"
          onClick={() => setPaletteOpen(!paletteOpen)}
        >
          {paletteOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Add Section
        </button>
        {paletteOpen && (
          <div className="px-2 pb-3 space-y-0.5 max-h-64 overflow-y-auto scrollbar-thin">
            {SECTION_TEMPLATES.map((template) => (
              <PaletteCard key={template.type} template={template} onAdd={onAddSection} />
            ))}
          </div>
        )}
      </div>

      {/* Layers (section list) */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <button
          className="flex items-center gap-2 w-full px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-white/5"
          onClick={() => setLayersOpen(!layersOpen)}
        >
          {layersOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Layers ({sections.length})
        </button>
        {layersOpen && (
          <div className="flex-1 px-2 pb-3 overflow-y-auto scrollbar-thin space-y-0.5">
            {sections.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                Click a section above to add it to your page
              </p>
            ) : (
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {sections.map((section) => (
                  <SortableSectionItem
                    key={section.id}
                    section={section}
                    isSelected={selectedSectionId === section.id}
                    onSelect={() => onSelectSection(section.id)}
                    onToggleVisibility={() => onToggleVisibility(section.id)}
                    onDelete={() => onDeleteSection(section.id)}
                  />
                ))}
              </SortableContext>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
