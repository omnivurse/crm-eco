-- Bulk load via psql \copy (much faster than INSERT for the notes table).
-- Run via:  psql 'postgresql://...supabase...' -f copy_load.sql
-- The \copy paths are RELATIVE to the directory you run psql from, so
-- run this from /Users/qloudagent/Desktop/CRM DATA/_clean/supabase.

\copy zoho_import.leads          FROM 'leads.csv'          WITH (FORMAT csv, HEADER, NULL '');
\copy zoho_import.contacts       FROM 'contacts.csv'       WITH (FORMAT csv, HEADER, NULL '');
\copy zoho_import.notes          FROM 'notes.csv'          WITH (FORMAT csv, HEADER, NULL '');
\copy zoho_import.unified_people FROM 'unified_people.csv' WITH (FORMAT csv, HEADER, NULL '');
