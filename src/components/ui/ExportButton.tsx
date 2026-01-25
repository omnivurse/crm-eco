import { useState } from 'react';
import { Download, FileText, FileJson } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExportButtonProps {
  onExport: (format: 'csv' | 'json') => Promise<{ success: boolean; error?: string }>;
  label?: string;
}

export function ExportButton({ onExport, label = 'Export' }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    setIsOpen(false);

    try {
      const result = await onExport(format);
      if (result.success) {
        alert(`Successfully exported as ${format.toUpperCase()}`);
      } else {
        alert(`Export failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={exporting}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-cyan-600 text-white font-medium hover:from-primary-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download size={18} />
        <span>{exporting ? 'Exporting...' : label}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-48 glass-card p-2 z-50"
          >
            <button
              onClick={() => handleExport('csv')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-all duration-200 text-left"
            >
              <FileText className="text-success-600" size={20} />
              <div>
                <div className="font-medium text-neutral-900 dark:text-white">CSV</div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">Excel compatible</div>
              </div>
            </button>
            <button
              onClick={() => handleExport('json')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-all duration-200 text-left"
            >
              <FileJson className="text-cyan-600 dark:text-cyan-400" size={20} />
              <div>
                <div className="font-medium text-neutral-900 dark:text-white">JSON</div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">API format</div>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
