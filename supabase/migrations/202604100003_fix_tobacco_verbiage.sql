-- Fix: Update tobacco_user field verbiage per client request.
-- The tooltip text is displayed as the label next to the checkbox in the form UI.

UPDATE crm_fields
SET label = 'Tobacco User',
    tooltip = 'Check box ONLY if member has used tobacco products w/in the past 12 months.'
WHERE key = 'tobacco_user';
