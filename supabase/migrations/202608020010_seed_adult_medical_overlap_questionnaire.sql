-- Seed Adult Intake medical-overlap questionnaire (idempotent).
-- Template key: adult_medical_overlap
-- Orgs: pay-it-forward-health, double-helix-software, smoke-test
-- Sets published + is_default so portal getDefaultQuestionnaireTemplate loads it.
-- Rollback: DELETE FROM questionnaire_templates WHERE key = 'adult_medical_overlap';
--   (questions/logic cascade).

SET lock_timeout = '5s';

DO $$
DECLARE
  org RECORD;
  tmpl_id uuid;
  q_has_pcp uuid;
  q_pcp_name uuid;
  q_has_chronic uuid;
  q_chronic_detail uuid;
  q_takes_meds uuid;
  q_meds_list uuid;
BEGIN
  FOR org IN
    SELECT id
    FROM public.organizations
    WHERE slug IN (
      'pay-it-forward-health',
      'double-helix-software',
      'smoke-test'
    )
  LOOP
    SELECT id INTO tmpl_id
    FROM public.questionnaire_templates
    WHERE organization_id = org.id
      AND key = 'adult_medical_overlap'
      AND version = 1;

    IF tmpl_id IS NULL THEN
      INSERT INTO public.questionnaire_templates (
        organization_id,
        key,
        name,
        version,
        status,
        is_default,
        description,
        metadata
      ) VALUES (
        org.id,
        'adult_medical_overlap',
        'Adult medical overlap',
        1,
        'published',
        false,
        'Health-share medical overlap (PCP, chronic conditions, medications, tobacco). Demographic Adult Intake stays separate.',
        jsonb_build_object('source', 'adult_intake_c5', 'seeded_at', now())
      )
      RETURNING id INTO tmpl_id;
    ELSE
      UPDATE public.questionnaire_templates
      SET
        name = 'Adult medical overlap',
        status = 'published',
        description = 'Health-share medical overlap (PCP, chronic conditions, medications, tobacco). Demographic Adult Intake stays separate.',
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('source', 'adult_intake_c5'),
        updated_at = now()
      WHERE id = tmpl_id;
    END IF;

    -- Promote to org default (partial unique: at most one default per org).
    UPDATE public.questionnaire_templates
    SET is_default = false
    WHERE organization_id = org.id
      AND is_default = true
      AND id <> tmpl_id;

    UPDATE public.questionnaire_templates
    SET is_default = true, status = 'published', updated_at = now()
    WHERE id = tmpl_id;

    -- Questions: insert only when template has none (safe re-run).
    IF NOT EXISTS (
      SELECT 1 FROM public.questionnaire_questions WHERE template_id = tmpl_id
    ) THEN
      INSERT INTO public.questionnaire_questions (
        organization_id, template_id, key, label, type, options, ordinal, required, help_text
      ) VALUES
        (org.id, tmpl_id, 'section_medical', 'Medical information', 'section', '[]'::jsonb, 0, false,
         'Brief health-share eligibility questions (not a clinical intake).'),
        (org.id, tmpl_id, 'has_primary_care_physician', 'Do you have a primary care physician (PCP)?', 'radio',
         '[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]'::jsonb, 1, true, null),
        (org.id, tmpl_id, 'pcp_name', 'Primary care physician name', 'text', '[]'::jsonb, 2, false, null),
        (org.id, tmpl_id, 'has_chronic_conditions', 'Do you have any chronic medical conditions?', 'radio',
         '[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]'::jsonb, 3, true, null),
        (org.id, tmpl_id, 'chronic_conditions_detail', 'Please describe your chronic conditions', 'text',
         '[]'::jsonb, 4, true, null),
        (org.id, tmpl_id, 'takes_medications', 'Do you currently take any prescription medications?', 'radio',
         '[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]'::jsonb, 5, true, null),
        (org.id, tmpl_id, 'medications_list', 'List current medications', 'text', '[]'::jsonb, 6, false,
         'Name and dose if known. Detailed Rx pricing can be added on the plan step.'),
        (org.id, tmpl_id, 'tobacco_use', 'Do you use tobacco products?', 'radio',
         '[{"value":"never","label":"Never"},{"value":"former","label":"Former"},{"value":"current","label":"Current"}]'::jsonb,
         7, true, null);
    END IF;

    -- Resolve question ids for logic wiring.
    SELECT id INTO q_has_pcp FROM public.questionnaire_questions
      WHERE template_id = tmpl_id AND key = 'has_primary_care_physician';
    SELECT id INTO q_pcp_name FROM public.questionnaire_questions
      WHERE template_id = tmpl_id AND key = 'pcp_name';
    SELECT id INTO q_has_chronic FROM public.questionnaire_questions
      WHERE template_id = tmpl_id AND key = 'has_chronic_conditions';
    SELECT id INTO q_chronic_detail FROM public.questionnaire_questions
      WHERE template_id = tmpl_id AND key = 'chronic_conditions_detail';
    SELECT id INTO q_takes_meds FROM public.questionnaire_questions
      WHERE template_id = tmpl_id AND key = 'takes_medications';
    SELECT id INTO q_meds_list FROM public.questionnaire_questions
      WHERE template_id = tmpl_id AND key = 'medications_list';

    -- Logic: show follow-ups when parent = yes (insert if missing).
    IF q_has_pcp IS NOT NULL AND q_pcp_name IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.questionnaire_logic
         WHERE template_id = tmpl_id
           AND source_question_id = q_has_pcp
           AND target_question_id = q_pcp_name
       ) THEN
      INSERT INTO public.questionnaire_logic (
        organization_id, template_id, source_question_id, target_question_id,
        action, condition, ordinal
      ) VALUES (
        org.id, tmpl_id, q_has_pcp, q_pcp_name, 'show',
        jsonb_build_object(
          'field', 'has_primary_care_physician',
          'operator', 'eq',
          'value', 'yes'
        ),
        0
      );
    END IF;

    IF q_has_chronic IS NOT NULL AND q_chronic_detail IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.questionnaire_logic
         WHERE template_id = tmpl_id
           AND source_question_id = q_has_chronic
           AND target_question_id = q_chronic_detail
       ) THEN
      INSERT INTO public.questionnaire_logic (
        organization_id, template_id, source_question_id, target_question_id,
        action, condition, ordinal
      ) VALUES (
        org.id, tmpl_id, q_has_chronic, q_chronic_detail, 'show',
        jsonb_build_object(
          'field', 'has_chronic_conditions',
          'operator', 'eq',
          'value', 'yes'
        ),
        1
      );
    END IF;

    IF q_takes_meds IS NOT NULL AND q_meds_list IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.questionnaire_logic
         WHERE template_id = tmpl_id
           AND source_question_id = q_takes_meds
           AND target_question_id = q_meds_list
       ) THEN
      INSERT INTO public.questionnaire_logic (
        organization_id, template_id, source_question_id, target_question_id,
        action, condition, ordinal
      ) VALUES (
        org.id, tmpl_id, q_takes_meds, q_meds_list, 'show',
        jsonb_build_object(
          'field', 'takes_medications',
          'operator', 'eq',
          'value', 'yes'
        ),
        2
      );
    END IF;
  END LOOP;
END $$;
