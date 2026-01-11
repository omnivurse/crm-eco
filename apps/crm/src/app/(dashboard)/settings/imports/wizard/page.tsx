import { getRoleQueryContext } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { WizardClient } from './wizard-client';

export default async function ImportWizardPage() {
  const context = await getRoleQueryContext();
  
  if (!context || !['owner', 'admin'].includes(context.role)) {
    redirect('/dashboard');
  }
  
  return <WizardClient />;
}
