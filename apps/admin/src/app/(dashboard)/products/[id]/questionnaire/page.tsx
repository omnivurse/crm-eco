import { Badge } from '@crm-eco/ui';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { QuestionnaireBuilder } from '@/components/products/QuestionnaireBuilder';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';
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
      <EntityPageHeader
        backHref={`/products/${product.id}`}
        backLabel={product.name}
        title="Questionnaire"
        subtitle={
          <span>
            {product.name}{' '}
            <span className="font-mono text-[var(--adm-ink)]/80">({product.code})</span>
          </span>
        }
        badges={
          product.questionnaire_template_id ? (
            <Badge variant="default" className="text-xs">
              Linked to a template
            </Badge>
          ) : undefined
        }
      />

      <QuestionnaireBuilder
        organizationId={organizationId}
        planId={product.id}
        planName={product.name}
      />
    </div>
  );
}
