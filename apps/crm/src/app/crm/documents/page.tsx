'use client';

import { FileText } from 'lucide-react';
import { EmptyState } from '@/components/crm/lists';

export default function DocumentsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Documents</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Store and organize your proposals, contracts, and files
                    </p>
                </div>
            </div>

            <EmptyState
                icon={FileText}
                title="No documents yet"
                description="Store and organize your proposals, contracts, and other files. Connect cloud storage or upload directly to attach documents to records."
                actionLabel="Upload First Document"
                actionHref="/crm/documents/upload"
                secondaryActionLabel="Connect Google Drive"
                secondaryActionHref="/crm/integrations/cloud-storage"
            />
        </div>
    );
}
