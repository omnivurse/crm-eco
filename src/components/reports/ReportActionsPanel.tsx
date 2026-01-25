import { useState } from 'react';
import {
  Download,
  Save,
  Users,
  Bell,
  Calendar,
  FileSpreadsheet,
  FileJson,
  ChevronDown,
} from 'lucide-react';
import type { ExportFormat } from 'shared';

interface ReportActionsPanelProps {
  onExport: (format: ExportFormat) => void;
  onSave: (name: string, description?: string) => void;
  onCreateSegment: (name: string, description?: string) => void;
  onSetAlert: () => void;
  onSchedule: () => void;
  isExporting?: boolean;
  isSaving?: boolean;
  selectedRowCount?: number;
}

export function ReportActionsPanel({
  onExport,
  onSave,
  onCreateSegment,
  onSetAlert,
  onSchedule,
  isExporting = false,
  isSaving = false,
  selectedRowCount = 0,
}: ReportActionsPanelProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [segmentName, setSegmentName] = useState('');
  const [segmentDescription, setSegmentDescription] = useState('');

  const handleExport = (format: ExportFormat) => {
    onExport(format);
    setShowExportMenu(false);
  };

  const handleSave = () => {
    if (saveName.trim()) {
      onSave(saveName.trim(), saveDescription.trim() || undefined);
      setShowSaveModal(false);
      setSaveName('');
      setSaveDescription('');
    }
  };

  const handleCreateSegment = () => {
    if (segmentName.trim()) {
      onCreateSegment(segmentName.trim(), segmentDescription.trim() || undefined);
      setShowSegmentModal(false);
      setSegmentName('');
      setSegmentDescription('');
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        {/* Export Button with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Exporting...' : 'Export'}</span>
            <ChevronDown className="w-4 h-4" />
          </button>

          {showExportMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-10 min-w-[150px]">
              <button
                onClick={() => handleExport('csv')}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                <Download className="w-4 h-4" />
                Export as CSV
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export as Excel
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                <FileJson className="w-4 h-4" />
                Export as JSON
              </button>
            </div>
          )}
        </div>

        {/* Save Report Button */}
        <button
          onClick={() => setShowSaveModal(true)}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save Report'}</span>
        </button>

        {/* Create Segment Button */}
        <button
          onClick={() => setShowSegmentModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg transition-colors"
        >
          <Users className="w-4 h-4" />
          <span>Create Segment</span>
          {selectedRowCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full">
              {selectedRowCount}
            </span>
          )}
        </button>

        {/* Set Alert Button */}
        <button
          onClick={onSetAlert}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span>Set Alert</span>
        </button>

        {/* Schedule Report Button */}
        <button
          onClick={onSchedule}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg transition-colors"
        >
          <Calendar className="w-4 h-4" />
          <span>Schedule</span>
        </button>
      </div>

      {/* Save Report Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Save Report
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Report Name
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Enter report name"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="Describe this report"
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Save Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Segment Modal */}
      {showSegmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Create Segment
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Save this result set for use in campaigns
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Segment Name
                </label>
                <input
                  type="text"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                  placeholder="e.g., Texas Active Members"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={segmentDescription}
                  onChange={(e) => setSegmentDescription(e.target.value)}
                  placeholder="Describe this segment"
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
              {selectedRowCount > 0 && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {selectedRowCount} records will be included in this segment
                </p>
              )}
            </div>
            <div className="p-6 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-3">
              <button
                onClick={() => setShowSegmentModal(false)}
                className="px-4 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSegment}
                disabled={!segmentName.trim()}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Create Segment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close dropdown on click outside */}
      {showExportMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </>
  );
}
