'use client';

import Link from 'next/link';
import { ShieldX, ArrowLeft, Mail } from 'lucide-react';

export default function CrmAccessDeniedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 mb-6">
            <ShieldX className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Access Denied</h1>
          <p className="text-slate-400 text-lg">
            You don&apos;t have permission to access the CRM module.
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8">
          <h2 className="text-white font-medium mb-3">Need Access?</h2>
          <p className="text-slate-400 text-sm mb-4">
            Contact your organization administrator to request CRM access. 
            They can assign you a CRM role from the settings page.
          </p>
          <a
            href="mailto:support@enrollflow.com"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
          >
            <Mail className="w-4 h-4" />
            support@enrollflow.com
          </a>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Dashboard
          </Link>
          <Link
            href="/crm-login"
            className="text-slate-400 hover:text-slate-300 text-sm"
          >
            Sign in with a different account
          </Link>
        </div>
      </div>
    </div>
  );
}
