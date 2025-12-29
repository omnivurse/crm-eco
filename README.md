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

## Roadmap

- [x] Phase 1: Core CRM (Members, Advisors, Tickets)
- [ ] Phase 2: Needs management with AI pricing
- [ ] Phase 3: Enrollment flows and landing pages
- [ ] Phase 4: Commission trees and billing
- [ ] Phase 5: Analytics and reporting

## License

Private - All rights reserved
