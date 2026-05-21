-- ============================================================================
-- Migration: 202605210007_seed_legal_documents_pifh
-- Purpose:   Seed default enrollment_agreement legal document for PIFH org
--            so the public enrollment wizard has content to render.
-- ============================================================================

BEGIN;

INSERT INTO legal_documents (
  organization_id,
  document_type,
  document_name,
  content_html,
  version,
  status,
  effective_date
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'enrollment_agreement',
  'Pay It Forward Health Enrollment Agreement',
  $html$
<h2>Pay It Forward Health Membership Agreement</h2>
<p><strong>Effective Date:</strong> {{effective_date}}</p>
<p>By signing below, I, <strong>{{member_name}}</strong>, acknowledge and agree to the following terms and conditions of my membership in the Pay It Forward Health (PIFH) community:</p>

<h3>1. Membership Overview</h3>
<p>Pay It Forward Health is a healthcare cost-sharing community where members voluntarily share medical expenses. This is <strong>NOT health insurance</strong> and is not subject to state insurance regulations.</p>

<h3>2. Monthly Contribution</h3>
<p>I agree to contribute <strong>${{base_monthly_cost}}</strong> per month, drafted on the 20th of each month for the following month's coverage. My membership is effective <strong>{{effective_date}}</strong>.</p>

<h3>3. Sharing Eligibility</h3>
<p>Eligible medical needs are reviewed and shared in accordance with PIFH guidelines. Pre-existing conditions, lifestyle-related conditions, and certain treatments may be excluded or have waiting periods.</p>

<h3>4. Initial Unshareable Amount (IUA)</h3>
<p>I am responsible for the first <strong>${{iua_amount}}</strong> of each medical event before community sharing applies.</p>

<h3>5. Cancellation Policy</h3>
<p>I may cancel my membership with 30 days written notice. Refunds are not available for partial months.</p>

<h3>6. Authorization</h3>
<p>I authorize PIFH and its payment processor to draft my monthly contribution from the payment method on file.</p>

<h3>7. Acknowledgements</h3>
<ul>
  <li>I understand this is not insurance and there is no guarantee that any medical bill will be paid.</li>
  <li>I have read and understand the PIFH Member Guidelines.</li>
  <li>I attest that all information provided in my enrollment is true and accurate.</li>
</ul>

<p style="margin-top: 2em;">By signing below, I acknowledge that I have read, understood, and agreed to all terms of this agreement.</p>
  $html$,
  1,
  'active',
  CURRENT_DATE
)
ON CONFLICT (organization_id, document_type, version) DO UPDATE
  SET content_html = EXCLUDED.content_html,
      status       = EXCLUDED.status,
      updated_at   = now();

-- Smoke-test org gets a copy too so the smoke test can find a doc to render
INSERT INTO legal_documents (
  organization_id,
  document_type,
  document_name,
  content_html,
  version,
  status,
  effective_date
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'enrollment_agreement',
  'Smoke Test Enrollment Agreement',
  '<h2>Smoke Test Agreement</h2><p>This is a test document for {{member_name}}, effective {{effective_date}}.</p>',
  1,
  'active',
  CURRENT_DATE
)
ON CONFLICT (organization_id, document_type, version) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;
