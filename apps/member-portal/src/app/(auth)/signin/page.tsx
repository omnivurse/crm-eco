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
    <div className="min-h-screen flex flex-row bg-dhh-ink">
      <div className="hidden lg:flex lg:w-[55%] xl:w-[58%] bg-dhh-ink animate-pulse" />
      <div className="w-full lg:w-[45%] xl:w-[42%] flex items-center justify-center bg-dhh-panel p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-3">
            <div className="h-8 w-48 bg-slate-700/50 rounded-lg animate-pulse" />
            <div className="h-4 w-64 bg-slate-700/30 rounded animate-pulse" />
          </div>
          <div className="space-y-5">
            <div className="h-14 bg-slate-800/50 rounded-xl animate-pulse" />
            <div className="h-14 bg-slate-800/50 rounded-xl animate-pulse" />
            <div className="h-14 bg-cyan-500/20 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
