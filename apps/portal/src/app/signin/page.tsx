import { Suspense } from 'react';
import { SignInForm } from './form';

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoading />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInLoading() {
  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Left panel skeleton */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] bg-gradient-to-br from-[#003560] via-[#04545c] to-[#047474]" />

      {/* Right panel skeleton */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-6 sm:p-8">
        <div className="w-full max-w-[420px] space-y-8">
          <div className="space-y-3">
            <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 space-y-5">
            <div className="space-y-2">
              <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
              <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
              <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
            </div>
            <div className="h-11 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
