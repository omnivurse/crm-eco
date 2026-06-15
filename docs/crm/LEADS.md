# Leads — canonical data model

All leads live in **`crm_records`**, filtered by the org's **Leads** module (`crm_modules.key = 'leads'`).

The legacy **`public.leads`** table was removed. Do not add new queries against `leads`.

## Where to look

| Concern | Location |
|--------|----------|
| List / detail UI | `/crm/modules/leads`, `/crm/r/:id` |
| Create (UI) | `CreateLeadDialog` → `POST /api/crm/records` |
| Convert to contact | RPC `convert_lead_to_contact(lead_id, …)` |
| Shared helpers | `@crm-eco/lib` → `resolveLeadsModuleId`, `insertCrmLead`, `crmRecordToLeadListItem` |
| Hide converted leads | `applyHideConvertedLeadsFilter` (lists, workqueue, exports) |

## Row shape

Top-level columns used for leads:

- `org_id`, `module_id`, `title`, `status`, `email`, `phone`, `advisor_id`
- `data` JSONB: `first_name`, `last_name`, `lead_source`, `lead_status`, `is_converted`, `converted_contact_id`, etc.

Status values use **Title Case** (`New`, `Contacted`, `Converted`, …). CSV imports may still send lowercase; normalize with `normalizeLeadStatus()`.

## Conversion

After lead → contact conversion, the lead row is **kept for audit** with `status = 'Converted'` and `data.is_converted = true`. Active lead lists exclude these rows; the live record is the new contact.

## Foreign keys

`activities.lead_id`, `enrollments.lead_id`, and `landing_page_events.lead_id` reference **`crm_records.id`** (leads module rows).
