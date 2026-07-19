import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import { Badge, Button } from '@crm-eco/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { QuestionnaireBuilder } from '@/components/products/QuestionnaireBuilder';
import { getActiveTenant } from '@/lib/tenant';

async function getProduct(id: string) {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const { data: product } = await (supabase
    .from('plans')
    .select('id, name, code, questionnaire_template_id')
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .single() as any);

  return { product, organizationId: tenant.organizationId };
}

export default async function ProductQuestionnairePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getProduct(id);

  if (!result?.product) {
    notFound();
  }

  const { product, organizationId } = result;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/products/${product.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft weight="light" className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Questionnaire</h1>
            {product.questionnaire_template_id && (
              <Badge variant="default" className="text-xs">
                Linked to a template
              </Badge>
            )}
          </div>
          <p className="text-slate-500">
            {product.name} <span className="font-mono">({product.code})</span>
          </p>
        </div>
      </div>

      <QuestionnaireBuilder
        organizationId={organizationId}
        planId={product.id}
        planName={product.name}
      />
    </div>
  );
}
