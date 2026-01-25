 -- Tickets
 create table if not exists tickets (
   id uuid primary key default gen_random_uuid(),
   requester_id uuid references profiles(id) on delete set null,
   assignee_id uuid references profiles(id) on delete set null,
+  origin text not null check (origin in ('member','advisor','staff')),
   subject text not null,
   description text,
-  status ticket_status default 'new',
+  status ticket_status default 'open',
   priority ticket_priority default 'medium',
   category text,
+  subcategory text,
   sla_due_at timestamptz,
+  submitter_email text,
+  submitter_name text,
+  submitter_phone text,
+  member_id_optional text,
+  advisor_id_optional text,
+  platform text,
+  browser text,
+  app_version text,
+  attachments text[],
   created_at timestamptz default now(),
   updated_at timestamptz default now()
 );

 create index if not exists idx_tickets_status on tickets(status);
+create index if not exists idx_tickets_origin on tickets(origin);
 create index if not exists idx_tickets_assignee on tickets(assignee_id);
+create index if not exists idx_tickets_created_at on tickets(created_at desc);