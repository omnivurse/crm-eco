'use client';

import type { FormSectionData } from '@/lib/landing-pages/types';

export function FormPreview({ data }: { data: FormSectionData }) {
  return (
    <div className="bg-white dark:bg-slate-900 px-8 py-12">
      <div className="max-w-lg mx-auto">
        {data.title && (
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">{data.title}</h2>
        )}
        {data.description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">{data.description}</p>
        )}
        <div className="space-y-4">
          {(data.fields || []).map((field) => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <div className="w-full h-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-400">
                  {field.placeholder}
                </div>
              ) : field.type === 'select' ? (
                <div className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 flex items-center text-sm text-slate-400">
                  {field.placeholder || 'Select...'}
                </div>
              ) : field.type === 'checkbox' ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border border-slate-300 dark:border-slate-600 rounded" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">{field.placeholder || field.label}</span>
                </div>
              ) : (
                <div className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 flex items-center text-sm text-slate-400">
                  {field.placeholder}
                </div>
              )}
            </div>
          ))}
          <button className="w-full py-2.5 bg-teal-600 text-white font-semibold rounded-lg text-sm hover:bg-teal-700 transition-colors">
            {data.submitButtonText || 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
