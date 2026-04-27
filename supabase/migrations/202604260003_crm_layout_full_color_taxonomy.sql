-- ============================================================================
-- CRM layout — full color taxonomy for Members / Leads / Contacts
--
-- The April 16 layout pass (202604160003) gave each *coverage* section a
-- distinct accent (Health Share = emerald, Insurance = blue, Dental = cyan,
-- Vision = purple, Other = amber, Life = rose, Family = pink, Start Date =
-- indigo). All other sections (Address, Management, Payment, Compliance,
-- Preferences, Activity, Identifiers, Portal, Fulfillment, Business, System,
-- Conversion, Product Interest…) defaulted to slate, so the support sections
-- are visually indistinguishable.
--
-- The client (familiar with Zoho) wants every section to carry a meaningful
-- color so the SectionNav pills + section cards are scannable. This migration
-- assigns the unified taxonomy across all three modules. The frontend now
-- recognises six additional accents (teal, sky, violet, orange, fuchsia, lime)
-- on top of the original nine.
--
-- Idempotent: re-running re-applies the same JSON.
-- ============================================================================

DO $$
DECLARE
  v_org_id              uuid;
  v_contacts_module_id  uuid;
  v_leads_module_id     uuid;
  v_members_module_id   uuid;
BEGIN
  FOR v_org_id IN
    SELECT DISTINCT org_id
      FROM crm_modules
     WHERE key IN ('contacts', 'leads', 'members')
  LOOP
    SELECT id INTO v_contacts_module_id FROM crm_modules
      WHERE org_id = v_org_id AND key = 'contacts';
    SELECT id INTO v_leads_module_id    FROM crm_modules
      WHERE org_id = v_org_id AND key = 'leads';
    SELECT id INTO v_members_module_id  FROM crm_modules
      WHERE org_id = v_org_id AND key = 'members';

    --------------------------------------------------------------------------
    -- Contacts
    --------------------------------------------------------------------------
    IF v_contacts_module_id IS NOT NULL THEN
      UPDATE crm_layouts
         SET config = jsonb_build_object(
           'sections', '[
             {"key":"core",                 "label":"Name",                       "columns":2, "accent":"slate",   "variant":"hero"},
             {"key":"notes_history",        "label":"Notes History",              "columns":1, "accent":"sky",     "collapsed":true},
             {"key":"start_date",           "label":"Start Date",                 "columns":2, "accent":"indigo"},
             {"key":"health_sharing",       "label":"Health Share Membership",    "columns":2, "accent":"emerald"},
             {"key":"insurance_coverage",   "label":"Insurance Products",         "columns":2, "accent":"blue"},
             {"key":"dental_coverage",      "label":"Dental",                     "columns":2, "accent":"cyan",    "collapsed":true},
             {"key":"vision_coverage",      "label":"Vision",                     "columns":2, "accent":"purple",  "collapsed":true},
             {"key":"other_coverage",       "label":"Other Coverage",             "columns":2, "accent":"amber",   "collapsed":true},
             {"key":"life_coverage",        "label":"Life Insurance",             "columns":2, "accent":"rose",    "collapsed":true},
             {"key":"family",               "label":"Family",                     "columns":2, "accent":"pink",    "collapsed":true},
             {"key":"address",              "label":"Address",                    "columns":2, "accent":"teal",    "collapsed":true},
             {"key":"management",           "label":"Ownership & Management",     "columns":2, "accent":"violet",  "collapsed":true},
             {"key":"payment",              "label":"Payment",                    "columns":2, "accent":"lime",    "collapsed":true},
             {"key":"identifiers",          "label":"Codes & Identifiers",        "columns":2, "accent":"slate",   "collapsed":true},
             {"key":"portal",               "label":"Portal Access",              "columns":2, "accent":"fuchsia", "collapsed":true},
             {"key":"compliance",           "label":"Compliance",                 "columns":2, "accent":"orange",  "collapsed":true},
             {"key":"fulfillment",          "label":"Fulfillment",                "columns":2, "accent":"amber",   "collapsed":true},
             {"key":"business",             "label":"Business Information",       "columns":2, "accent":"slate",   "collapsed":true},
             {"key":"preferences",          "label":"Communication Preferences",  "columns":2, "accent":"sky",     "collapsed":true},
             {"key":"additional",           "label":"Additional Information",     "columns":2, "accent":"slate",   "collapsed":true},
             {"key":"activity",             "label":"Activity & Analytics",       "columns":2, "accent":"violet",  "collapsed":true},
             {"key":"commissions",          "label":"Commissions",                "columns":2, "accent":"lime",    "collapsed":true},
             {"key":"zoho_system",          "label":"System",                     "columns":2, "accent":"slate",   "collapsed":true}
           ]'::jsonb
         ),
           updated_at = now()
       WHERE module_id = v_contacts_module_id AND is_default = true;
    END IF;

    --------------------------------------------------------------------------
    -- Leads
    --------------------------------------------------------------------------
    IF v_leads_module_id IS NOT NULL THEN
      UPDATE crm_layouts
         SET config = jsonb_build_object(
           'sections', '[
             {"key":"core",                 "label":"Name",                       "columns":2, "accent":"slate",   "variant":"hero"},
             {"key":"notes_history",        "label":"Notes History",              "columns":1, "accent":"sky",     "collapsed":true},
             {"key":"start_date",           "label":"Start Date",                 "columns":2, "accent":"indigo"},
             {"key":"health_sharing",       "label":"Health Share Membership",    "columns":2, "accent":"emerald"},
             {"key":"insurance_coverage",   "label":"Insurance Products",         "columns":2, "accent":"blue"},
             {"key":"dental_coverage",      "label":"Dental",                     "columns":2, "accent":"cyan",    "collapsed":true},
             {"key":"vision_coverage",      "label":"Vision",                     "columns":2, "accent":"purple",  "collapsed":true},
             {"key":"other_coverage",       "label":"Other Coverage",             "columns":2, "accent":"amber",   "collapsed":true},
             {"key":"life_coverage",        "label":"Life Insurance",             "columns":2, "accent":"rose",    "collapsed":true},
             {"key":"family",               "label":"Family",                     "columns":2, "accent":"pink",    "collapsed":true},
             {"key":"address",              "label":"Address",                    "columns":2, "accent":"teal",    "collapsed":true},
             {"key":"management",           "label":"Lead Management",            "columns":2, "accent":"violet",  "collapsed":true},
             {"key":"product",              "label":"Product Interest",           "columns":2, "accent":"blue",    "collapsed":true},
             {"key":"conversion",           "label":"Conversion",                 "columns":2, "accent":"emerald", "collapsed":true},
             {"key":"preferences",          "label":"Preferences",                "columns":2, "accent":"sky",     "collapsed":true},
             {"key":"commissions",          "label":"Commissions",                "columns":2, "accent":"lime",    "collapsed":true},
             {"key":"system",               "label":"System Information",         "columns":2, "accent":"slate",   "collapsed":true}
           ]'::jsonb
         ),
           updated_at = now()
       WHERE module_id = v_leads_module_id AND is_default = true;
    END IF;

    --------------------------------------------------------------------------
    -- Members
    --------------------------------------------------------------------------
    IF v_members_module_id IS NOT NULL THEN
      UPDATE crm_layouts
         SET config = jsonb_build_object(
           'sections', '[
             {"key":"core",                 "label":"Name",                       "columns":2, "accent":"slate",   "variant":"hero"},
             {"key":"main",                 "label":"Member Information",         "columns":2, "accent":"slate"},
             {"key":"notes_history",        "label":"Notes History",              "columns":1, "accent":"sky",     "collapsed":true},
             {"key":"start_date",           "label":"Start Date",                 "columns":2, "accent":"indigo"},
             {"key":"health_sharing",       "label":"Health Share Membership",    "columns":2, "accent":"emerald"},
             {"key":"insurance_coverage",   "label":"Insurance Products",         "columns":2, "accent":"blue"},
             {"key":"dental_coverage",      "label":"Dental",                     "columns":2, "accent":"cyan",    "collapsed":true},
             {"key":"vision_coverage",      "label":"Vision",                     "columns":2, "accent":"purple",  "collapsed":true},
             {"key":"other_coverage",       "label":"Other Coverage",             "columns":2, "accent":"amber",   "collapsed":true},
             {"key":"life_coverage",        "label":"Life Insurance",             "columns":2, "accent":"rose",    "collapsed":true},
             {"key":"family",               "label":"Family",                     "columns":2, "accent":"pink",    "collapsed":true},
             {"key":"address",              "label":"Address",                    "columns":2, "accent":"teal",    "collapsed":true},
             {"key":"management",           "label":"Ownership & Management",     "columns":2, "accent":"violet",  "collapsed":true},
             {"key":"payment",              "label":"Payment",                    "columns":2, "accent":"lime",    "collapsed":true},
             {"key":"compliance",           "label":"Compliance",                 "columns":2, "accent":"orange",  "collapsed":true},
             {"key":"preferences",          "label":"Communication Preferences",  "columns":2, "accent":"sky",     "collapsed":true},
             {"key":"activity",             "label":"Activity & Analytics",       "columns":2, "accent":"violet",  "collapsed":true},
             {"key":"commissions",          "label":"Commissions",                "columns":2, "accent":"lime",    "collapsed":true},
             {"key":"system",               "label":"System Information",         "columns":2, "accent":"slate",   "collapsed":true}
           ]'::jsonb
         ),
           updated_at = now()
       WHERE module_id = v_members_module_id AND is_default = true;
    END IF;

  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
