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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto animate-pulse">
          <div className="w-6 h-6 bg-white/50 rounded" />
        </div>
        <div className="mt-4 h-8 bg-slate-200 rounded w-32 mx-auto animate-pulse" />
      </div>
    </div>
  );
}
