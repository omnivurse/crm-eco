# CRM-ECO

Modern CRM platform for healthshare and insurance organizations. Built with Next.js 14, Supabase, and shadcn/ui.

## Features

- **Multi-tenant architecture** - Organizations with role-based access control
- **Member management** - Track members, plans, and enrollment status
- **Advisor network** - Manage advisors with commission tiers and hierarchies
- **Ticket system** - Support tickets with categories and priority levels
- **Needs tracking** - Healthcare needs and reimbursement processing (Phase 2)
- **Lead management** - Capture and convert leads from enrollment forms (Phase 2)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS + shadcn/ui
- **Monorepo**: Turborepo + npm workspaces
- **Language**: TypeScript

## Project Structure

```
crm-eco/
├── apps/
│   └── crm/                 # Next.js 14 application
│       └── src/
│           ├── app/         # App Router pages
│           ├── components/  # React components
│           └── middleware.ts
├── packages/
│   ├── ui/                  # Shared UI components (shadcn)
│   └── lib/                 # Shared utilities & Supabase client
├── supabase/
│   ├── migrations/          # Database migrations
│   └── seed/                # Seed data
└── turbo.json               # Turborepo config
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 10+
- Supabase CLI

### Installation

1. Clone the repository:
```bash
git clone https://github.com/oiagent/crm-eco.git
cd crm-eco
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp apps/crm/env.example apps/crm/.env.local
```

Edit `.env.local` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Link Supabase project and push migrations:
```bash
supabase link --project-ref your-project-ref
supabase db push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Database Schema

The platform uses the following core tables:

- `organizations` - Multi-tenant root entity
- `profiles` - User profiles linked to Supabase Auth
- `advisors` - Advisor records with license info and commission tiers
- `members` - Member records with plan details
- `leads` - Sales leads and enrollment prospects
- `tickets` - Support tickets
- `ticket_comments` - Ticket conversation threads
- `needs` - Healthcare needs for reimbursement
- `need_events` - Need processing timeline
- `activities` - Audit log
- `custom_field_definitions` - Dynamic field configurations

All tables support Row Level Security (RLS) for multi-tenant data isolation.

## User Roles

| Role | Permissions |
|------|-------------|
| `owner` | Full organization access, can manage settings |
| `admin` | Full access except dangerous operations |
| `advisor` | Can view/edit assigned members, leads, tickets |
| `staff` | Configurable, typically read/write access |

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run linting
npm run db:push      # Push migrations to Supabase
npm run db:reset     # Reset database
npm run db:generate-types  # Generate TypeScript types
```

## Deployment

### Vercel

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel project settings
3. Deploy

### Environment Variables (Production)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Enterprise CRM Application

The CRM includes a separate, enterprise-grade CRM application with Zoho-style customization capabilities.

### CRM Features

- **Separate Login Surface** - Dedicated CRM login at `/crm-login`
- **Configurable Modules** - Create custom modules (Contacts, Leads, Deals, etc.)
- **Custom Fields** - Define text, number, date, select, multiselect, boolean, email, phone, URL, currency, lookup, and user fields
- **Dynamic Layouts** - Organize fields into collapsible sections
- **Saved Views** - Create filtered, sorted views with custom column configurations
- **Import Wizard** - 5-step CSV import with auto-mapping and validation
- **Activity Timeline** - Notes, tasks, and audit history on records
- **Role-Based Access** - CRM-specific roles (Admin, Manager, Agent, Viewer)
- **Command Palette** - Quick actions with ⌘K

### CRM Roles

| Role | Permissions |
|------|-------------|
| `crm_admin` | Full CRM access, manage modules/fields/layouts |
| `crm_manager` | Create/edit/delete records, run imports |
| `crm_agent` | Create/edit records, add notes/tasks |
| `crm_viewer` | Read-only access |

### CRM Setup

1. **Run the CRM migration:**
```bash
supabase db push
```

2. **Seed default modules and fields:**
```bash
psql $DATABASE_URL -f supabase/seed/crm_seed.sql
```

3. **Grant CRM access to a user:**
```sql
UPDATE profiles 
SET crm_role = 'crm_admin' 
WHERE email = 'your-email@example.com';
```

4. **Access the CRM:**
- Navigate to `/crm-login`
- Sign in with your credentials
- You'll be redirected to the CRM dashboard

### CRM Database Schema

The CRM uses these additional tables:

| Table | Purpose |
|-------|---------|
| `crm_modules` | Configurable CRM modules |
| `crm_fields` | Field definitions per module |
| `crm_layouts` | Page layout configurations |
| `crm_views` | Saved list views |
| `crm_records` | Flexible record storage with jsonb |
| `crm_notes` | Notes on records |
| `crm_tasks` | Tasks linked to records |
| `crm_attachments` | File attachments |
| `crm_relations` | Record-to-record links |
| `crm_audit_log` | Change history |
| `crm_import_jobs` | Import job tracking |
| `crm_import_rows` | Individual row status |
| `crm_import_mappings` | Reusable field mappings |

### CRM API Endpoints

```
POST   /api/crm/records          # Create record
PATCH  /api/crm/records/:id      # Update record
DELETE /api/crm/records/:id      # Delete record
POST   /api/crm/notes            # Add note
POST   /api/crm/import           # Run CSV import
POST   /api/crm/modules          # Create module (admin)
PATCH  /api/crm/modules/:id      # Update module (admin)
POST   /api/crm/fields           # Create field (admin)
DELETE /api/crm/fields/:id       # Delete field (admin)
```

### Importing Zoho CRM Data

The import wizard supports Zoho CRM CSV exports:

1. Export your Leads/Contacts from Zoho CRM
2. Go to `/import` in the CRM
3. Upload the CSV file
4. Select target module (Contacts, Leads, etc.)
5. Map columns (auto-detection supported)
6. Preview and validate
7. Execute import

Default field mappings recognize common Zoho column names like `First Name`, `Last Name`, `Email`, `Lead Status`, etc.

### Integration with Enrollment Data

The CRM can access enrollment data through read-only views:

- `crm_ext.members` - View member records
- `crm_ext.enrollments` - View enrollment records
- `crm_ext.advisors` - View advisor records

These views respect existing RLS policies.

## Roadmap

- [x] Phase 1: Core CRM (Members, Advisors, Tickets)
- [x] Phase 2: Enterprise CRM with Zoho-style customization
- [x] Phase 3: Needs management with AI pricing
- [x] Phase 4: Enrollment flows and landing pages
- [x] Phase 5: Commission trees and billing
- [x] Phase 6: Analytics and reporting

## License

Private - All rights reserved
