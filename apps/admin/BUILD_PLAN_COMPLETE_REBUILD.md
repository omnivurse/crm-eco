 # COMPLETE SYSTEM REBUILD SPECIFICATION
 ## Health Insurance Enrollment & CRM Administration System

 Use this specification to recreate the entire system. This document contains every feature, function, database schema, and implementation
 detail needed for a complete rebuild.

 ---

 ## MASTER BUILD PROMPT

 ```
 Build a comprehensive Health Insurance Enrollment and CRM Administration System with the following complete specifications:

 ### TECHNOLOGY STACK (Required)
 - Frontend: React 18+ with TypeScript
 - Build Tool: Vite
 - Styling: Tailwind CSS 3.4+
 - Routing: React Router DOM 6+
 - Backend/Database: Supabase (PostgreSQL + Edge Functions + Auth)
 - Payment Processing: Authorize.Net (Accept.js for tokenization)
 - Email Service: Resend API
 - Charts: Recharts
 - Animations: Framer Motion
 - Icons: Lucide React
 - Internationalization: i18next + react-i18next (English & Portuguese)

 ---

 ## PART 1: DATABASE SCHEMA

 Create the following PostgreSQL tables in Supabase:

 ### 1.1 USERS TABLE
 ```sql
 CREATE TABLE users (
   id UUID PRIMARY KEY REFERENCES auth.users(id),
   email TEXT UNIQUE NOT NULL,
   full_name TEXT,
   role TEXT CHECK (role IN ('super_admin', 'admin', 'manager', 'user', 'agent')),
   user_type TEXT CHECK (user_type IN ('admin', 'agent')),
   status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
   is_activated BOOLEAN DEFAULT false,
   avatar_url TEXT,
   phone TEXT,
   last_login TIMESTAMPTZ,
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW(),
   created_by UUID REFERENCES users(id)
 );
 ```

 ### 1.2 AGENTS TABLE
 ```sql
 CREATE TABLE agents (
   id TEXT PRIMARY KEY, -- 6-digit numeric ID, auto-generated
   first_name TEXT NOT NULL,
   last_name TEXT NOT NULL,
   email TEXT UNIQUE NOT NULL,
   phone TEXT,
   status TEXT DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending', 'suspended')),
   role TEXT DEFAULT 'Agent' CHECK (role IN ('Agent', 'Agency')),
   enrollment_code TEXT UNIQUE,
   commission_eligible BOOLEAN DEFAULT true,
   parent_agent_id TEXT REFERENCES agents(id),
   user_id UUID REFERENCES auth.users(id),
   -- Branding fields
   company_name TEXT,
   website_url TEXT,
   logo_url TEXT,
   logo_size TEXT DEFAULT 'medium',
   primary_color TEXT DEFAULT '#1e40af',
   secondary_color TEXT DEFAULT '#3b82f6',
   header_bg_color TEXT DEFAULT '#1e3a8a',
   header_text_color TEXT DEFAULT '#ffffff',
   -- Address
   street_address TEXT,
   apartment TEXT,
   city TEXT,
   state TEXT,
   zip_code TEXT,
   country TEXT DEFAULT 'USA',
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );

 -- Auto-generate 6-digit agent ID
 CREATE OR REPLACE FUNCTION generate_agent_id()
 RETURNS TRIGGER AS $$
 BEGIN
   NEW.id := LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');
   RETURN NEW;
 END;
 $$ LANGUAGE plpgsql;
 ```

 ### 1.3 MEMBERS TABLE
 ```sql
 CREATE TABLE members (
   id TEXT PRIMARY KEY, -- 8-digit string ID
   first_name TEXT NOT NULL,
   last_name TEXT NOT NULL,
   date_of_birth DATE NOT NULL,
   gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
   existing_condition BOOLEAN DEFAULT false,
   existing_condition_description TEXT,
   country TEXT DEFAULT 'USA' CHECK (country IN ('USA', 'Brazil')),
   street_address TEXT,
   apartment TEXT,
   city TEXT,
   state TEXT,
   zip_code TEXT,
   phone_number TEXT,
   email TEXT,
   receive_emails BOOLEAN DEFAULT true,
   additional_info TEXT,
   agent_id TEXT REFERENCES agents(id),
   enrollment_id UUID,
   enrollment_status TEXT DEFAULT 'pending' CHECK (enrollment_status IN ('pending', 'rejected', 'active', 'inactive', 'cancelled')),
   -- Authorize.Net IDs
   customer_profile_id TEXT,
   payment_profile_id TEXT,
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );

 -- Auto-generate 8-digit member ID
 CREATE OR REPLACE FUNCTION generate_member_id()
 RETURNS TRIGGER AS $$
 BEGIN
   NEW.id := LPAD(FLOOR(RANDOM() * 90000000 + 10000000)::TEXT, 8, '0');
   RETURN NEW;
 END;
 $$ LANGUAGE plpgsql;
 ```

 ### 1.4 DEPENDENTS TABLE
 ```sql
 CREATE TABLE dependents (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
   first_name TEXT NOT NULL,
   last_name TEXT NOT NULL,
   date_of_birth DATE NOT NULL,
   gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
   relationship TEXT NOT NULL CHECK (relationship IN ('Spouse', 'Child')),
   is_smoker BOOLEAN DEFAULT false,
   existing_condition BOOLEAN DEFAULT false,
   existing_condition_description TEXT,
   same_address_as_member BOOLEAN DEFAULT true,
   street_address TEXT,
   apartment TEXT,
   city TEXT,
   state TEXT,
   zip_code TEXT,
   phone_number TEXT,
   email TEXT,
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );
 ```

 ### 1.5 PRODUCTS TABLE
 ```sql
 CREATE TABLE products (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   name TEXT NOT NULL,
   label TEXT,
   description TEXT,
   category TEXT,
   provider TEXT,
   status BOOLEAN DEFAULT true,
   start_date DATE,
   end_date DATE,
   default_iua INTEGER,
   require_dependent_info BOOLEAN DEFAULT false,
   require_dependent_address_match BOOLEAN DEFAULT false,
   hide_from_public BOOLEAN DEFAULT false,
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );
 ```

 ### 1.6 PRODUCT PRICING TABLES
 ```sql
 -- IUA Levels (Initial Unshared Amount / Deductible levels)
 CREATE TABLE product_iua (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
   amount INTEGER NOT NULL,
   created_at TIMESTAMPTZ DEFAULT NOW()
 );

 -- Age Brackets
 CREATE TABLE product_age_brackets (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
   min_age INTEGER NOT NULL,
   max_age INTEGER NOT NULL,
   label TEXT,
   created_at TIMESTAMPTZ DEFAULT NOW()
 );

 -- Benefit Types
 CREATE TABLE product_benefit_types (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   name TEXT NOT NULL,
   description TEXT,
   created_at TIMESTAMPTZ DEFAULT NOW()
 );

 -- Pricing Matrix (Price lookup by product, benefit type, IUA, age bracket)
 CREATE TABLE product_pricing_matrix (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
   benefit_type_id UUID REFERENCES product_benefit_types(id),
   iua_id UUID REFERENCES product_iua(id),
   age_bracket_id UUID REFERENCES product_age_brackets(id),
   price DECIMAL(10,2) NOT NULL,
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );

 -- Vendor Costs (for commission calculations)
 CREATE TABLE vendor_costs (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
   benefit_type_id UUID REFERENCES product_benefit_types(id),
   iua_id UUID REFERENCES product_iua(id),
   age_bracket_id UUID REFERENCES product_age_brackets(id),
   cost DECIMAL(10,2) NOT NULL,
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );

 -- Product Benefits (feature descriptions)
 CREATE TABLE product_benefits (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
   benefit_name TEXT NOT NULL,
   description TEXT,
   sort_order INTEGER DEFAULT 0,
   created_at TIMESTAMPTZ DEFAULT NOW()
 );

 -- Extra Costs (setup fees, annual fees, etc.)
 CREATE TABLE product_extra_costs (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
   name TEXT NOT NULL,
   amount DECIMAL(10,2) NOT NULL,
   frequency TEXT CHECK (frequency IN ('Monthly', 'Yearly', 'One-time')),
   condition TEXT,
   description TEXT,
   is_commissional BOOLEAN DEFAULT false,
   created_at TIMESTAMPTZ DEFAULT NOW()
 );
 ```

 ### 1.7 ENROLLMENTS TABLE
 ```sql
 CREATE TABLE enrollments (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   member_id TEXT NOT NULL REFERENCES members(id),
   product_id UUID NOT NULL REFERENCES products(id),
   agent_id TEXT REFERENCES agents(id),
   agent_first_name TEXT,
   agent_last_name TEXT,
   agent_level TEXT,
   pricing_matrix_id UUID REFERENCES product_pricing_matrix(id),
   iua_id UUID REFERENCES product_iua(id),
   plan_type TEXT CHECK (plan_type IN ('Member Only', 'Member + Spouse', 'Member + Children', 'Member + Family')),
   enrollment_date DATE DEFAULT CURRENT_DATE,
   start_date DATE,
   end_date DATE,
   inactive_date DATE,
   status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Active', 'Future Active', 'Inactive', 'Future Inactive', 'Cancelled')),
   primary_is_smoker BOOLEAN DEFAULT false,
   monthly_cost DECIMAL(10,2),
   initial_payment_paid BOOLEAN DEFAULT false,
   agreed_to_terms BOOLEAN DEFAULT false,
   inactive_reason TEXT,
   source TEXT,
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );

 -- Enrollment Dependents (links dependents to enrollments)
 CREATE TABLE enrollment_dependents (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
   dependent_id UUID NOT NULL REFERENCES dependents(id),
   relationship TEXT,
   status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Pending')),
   is_smoker BOOLEAN DEFAULT false,
   is_primary BOOLEAN DEFAULT false,
   inactive_date DATE,
   inactive_reason TEXT,
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );
 ```

 ### 1.8 BILLING TABLES
 ```sql
 CREATE TABLE billing (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   enrollment_id UUID REFERENCES enrollments(id),
   member_id TEXT REFERENCES members(id),
   product_id UUID REFERENCES products(id),
   billing_type TEXT CHECK (billing_type IN ('Monthly', 'Yearly', 'One-time')),
   description TEXT,
   amount DECIMAL(10,2) NOT NULL,
   status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Failed', 'Cancelled')),
   due_date DATE,
   paid_at TIMESTAMPTZ,
   payment_method TEXT,
   payment_method_last4 TEXT,
   customer_profile_id TEXT,
   payment_profile_id TEXT,
   transaction_id TEXT,
   error_message TEXT,
   notes TEXT,
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );

 CREATE TABLE payment_profiles (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   member_id TEXT NOT NULL REFERENCES members(id),
   customer_profile_id TEXT NOT NULL,
   payment_profile_id TEXT NOT NULL,
   card_last4 TEXT,
   card_type TEXT,
   expiration_date TEXT,
   is_default BOOLEAN DEFAULT false,
   status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );

 CREATE TABLE billing_schedules (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   enrollment_id UUID NOT NULL REFERENCES enrollments(id),
   member_id TEXT NOT NULL REFERENCES members(id),
   billing_type TEXT CHECK (billing_type IN ('monthly', 'annual')),
   amount DECIMAL(10,2) NOT NULL,
   next_billing_date DATE NOT NULL,
   status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );

 CREATE TABLE billing_failures (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   billing_schedule_id UUID REFERENCES billing_schedules(id),
   enrollment_id UUID REFERENCES enrollments(id),
   member_id TEXT REFERENCES members(id),
   billing_type TEXT,
   amount DECIMAL(10,2),
   failure_reason TEXT,
   status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'abandoned')),
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );
 ```

 ### 1.9 COMMISSION TABLES
 ```sql
 CREATE TABLE agent_levels (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   name TEXT NOT NULL, -- e.g., 'Advisor', 'Leader', 'Director', 'Agency'
   min_members INTEGER,
   max_members INTEGER,
   created_at TIMESTAMPTZ DEFAULT NOW()
 );

 CREATE TABLE commission_rates (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   agent_level_id UUID REFERENCES agent_levels(id),
   plan_type TEXT,
   monthly_amount DECIMAL(10,2),
   benefit_type_id UUID REFERENCES product_benefit_types(id),
   product_id UUID REFERENCES products(id),
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );

 CREATE TABLE agent_product_access (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   agent_id TEXT NOT NULL REFERENCES agents(id),
   product_id UUID NOT NULL REFERENCES products(id),
   created_at TIMESTAMPTZ DEFAULT NOW(),
   UNIQUE(agent_id, product_id)
 );
 ```

 ### 1.10 TRACKING & ANALYTICS TABLES
 ```sql
 CREATE TABLE enrollment_links (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   agent_id TEXT NOT NULL REFERENCES agents(id),
   name TEXT NOT NULL,
   slug TEXT NOT NULL UNIQUE,
   description TEXT,
   is_active BOOLEAN DEFAULT true,
   utm_source TEXT,
   utm_medium TEXT,
   utm_campaign TEXT,
   utm_term TEXT,
   utm_content TEXT,
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );

 CREATE TABLE enrollment_link_visits (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   link_id UUID NOT NULL REFERENCES enrollment_links(id),
   agent_id TEXT REFERENCES agents(id),
   visited_at TIMESTAMPTZ DEFAULT NOW(),
   ip_address TEXT,
   user_agent TEXT,
   referrer TEXT,
   device_type TEXT,
   browser TEXT,
   os TEXT,
   country TEXT,
   city TEXT,
   converted BOOLEAN DEFAULT false,
   conversion_id UUID,
   session_id TEXT
 );

 CREATE TABLE enrollment_link_conversions (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   link_id UUID REFERENCES enrollment_links(id),
   visit_id UUID REFERENCES enrollment_link_visits(id),
   agent_id TEXT REFERENCES agents(id),
   enrollment_id UUID REFERENCES enrollments(id),
   member_id TEXT REFERENCES members(id),
   converted_at TIMESTAMPTZ DEFAULT NOW(),
   time_to_convert INTEGER, -- seconds from visit to conversion
   created_at TIMESTAMPTZ DEFAULT NOW()
 );
 ```

 ### 1.11 SYSTEM & LOGGING TABLES
 ```sql
 CREATE TABLE sent_emails (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   member_id TEXT REFERENCES members(id),
   email_type TEXT NOT NULL,
   subject TEXT,
   recipient_email TEXT NOT NULL,
   sent_at TIMESTAMPTZ DEFAULT NOW(),
   status TEXT DEFAULT 'pending' CHECK (status IN ('sent', 'failed', 'pending')),
   details JSONB,
   transaction_id TEXT,
   enrollment_id UUID REFERENCES enrollments(id),
   created_at TIMESTAMPTZ DEFAULT NOW()
 );

 CREATE TABLE system_settings (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   setting_key TEXT UNIQUE NOT NULL,
   setting_value TEXT,
   category TEXT,
   description TEXT,
   is_active BOOLEAN DEFAULT true,
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW(),
   updated_by UUID REFERENCES users(id)
 );

 CREATE TABLE enrollment_contracts (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   enrollment_id UUID NOT NULL REFERENCES enrollments(id),
   member_id TEXT REFERENCES members(id),
   url TEXT,
   status TEXT DEFAULT 'pending',
   contract_type TEXT,
   generated_at TIMESTAMPTZ,
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );

 CREATE TABLE enrollment_logs (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   enrollment_id UUID REFERENCES enrollments(id),
   member_id TEXT REFERENCES members(id),
   agent_id TEXT REFERENCES agents(id),
   action TEXT NOT NULL,
   status_before TEXT,
   status_after TEXT,
   details JSONB,
   error_message TEXT,
   created_at TIMESTAMPTZ DEFAULT NOW()
 );

 CREATE TABLE promo_codes (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   code TEXT UNIQUE NOT NULL,
   description TEXT,
   discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
   discount_value DECIMAL(10,2),
   valid_from DATE,
   valid_until DATE,
   max_uses INTEGER,
   current_uses INTEGER DEFAULT 0,
   is_active BOOLEAN DEFAULT true,
   created_at TIMESTAMPTZ DEFAULT NOW(),
   updated_at TIMESTAMPTZ DEFAULT NOW()
 );
 ```

 ---

 ## PART 2: AUTHENTICATION & AUTHORIZATION

 ### 2.1 AuthContext Implementation
 ```typescript
 // Create AuthContext with the following features:
 interface AuthContextType {
   user: User | null;
   session: Session | null;
   loading: boolean;
   userType: 'admin' | 'agent' | null;
   userRecord: UserRecord | null;
   agent: Agent | null;
   agentLoading: boolean;
   signIn: (email: string, password: string) => Promise<void>;
   signOut: () => Promise<void>;
   signUp: (email: string, password: string, metadata?: object) => Promise<void>;
 }

 // Role Detection Logic:
 // 1. Check user_metadata.userType first
 // 2. Check email domain (@yourdomain.com = admin)
 // 3. Query agents table to find agent record
 // 4. Check activation status for agents

 // System Admin Domains (configurable):
 const ADMIN_DOMAINS = ['@yourdomain.com', '@youradmin.com'];
 ```

 ### 2.2 Protected Routes
 ```typescript
 // ProtectedRoute component checks:
 // - User is authenticated
 // - User has required role (admin or agent)
 // - Agent is activated (for agent role)
 // - Redirects to appropriate login/dashboard if unauthorized
 ```

 ---

 ## PART 3: APPLICATION ROUTES

 ### 3.1 Public Routes
 ```
 /signin                                    - Sign in page
 /signup                                    - Agent registration
 /admins/signup                            - Admin registration
 /reset-password                           - Password reset
 /enroll/:agentId                          - Enrollment entry (by agent)
 /enroll/:agentId/product/:productId       - Product enrollment
 /enroll/website-enrollment/product/:productId - Website direct enrollment
 /enrollment-success                       - Enrollment confirmation
 ```

 ### 3.2 Admin Portal Routes (/admin/*)
 ```
 /admin/dashboard                          - Main dashboard with metrics
 /admin/members                            - Member listing with search/filter
 /admin/members/add                        - Add new member
 /admin/members/:memberId                  - Member profile view
 /admin/members/:memberId/edit             - Edit member details
 /admin/members/:memberId/enrollment/new   - Create enrollment for member
 /admin/agents                             - Agent listing
 /admin/agents/:agentId                    - Agent profile
 /admin/agents/:agentId/edit               - Edit agent details
 /admin/products                           - Product catalog
 /admin/products/add-product               - Add new product
 /admin/products/:productId                - Product management (pricing, benefits)
 /admin/enrollments                        - All enrollments
 /admin/enrollments/:enrollmentId/edit     - Edit enrollment
 /admin/billing                            - Billing overview
 /admin/billing-schedules                  - Manage billing schedules
 /admin/billing-records                    - Payment history
 /admin/commission-report                  - Commission analytics
 /admin/vendor-cost-report                 - Vendor cost analytics
 /admin/enrollment-analytics               - Enrollment analytics
 /admin/enrollment-logs                    - Audit logs
 /admin/ops                                - Operations dashboard
 /admin/promo-codes                        - Promo code management
 /admin/settings                           - System settings
 ```

 ### 3.3 Agent Portal Routes (/agent/*)
 ```
 /agent/dashboard                          - Agent dashboard
 /agent/members                            - Agent's members
 /agent/members/:memberId                  - Member profile
 /agent/enrollments                        - Agent's enrollments
 /agent/commissions                        - Commission tracking
 /agent/reporting                          - Reports & analytics
 /agent/downline                           - Downline agents
 /agent/downline/:agentId                  - Downline agent profile
 /agent/profile                            - Agent's own profile
 /agent/settings                           - Agent settings
 ```

 ---

 ## PART 4: FEATURES & MODULES

 ### 4.1 MEMBER MANAGEMENT
 Features to implement:
 - Create member with personal info, address, contact details
 - Add/edit/remove dependents (Spouse, Children)
 - Track enrollment status (pending, active, inactive, cancelled)
 - View member profile with all dependents and enrollments
 - Search members by name, email, ID, phone
 - Filter by status, agent, date range
 - Export member data to CSV
 - Member notes/comments system
 - Payment profile management

 ### 4.2 AGENT MANAGEMENT
 Features to implement:
 - Create agents with full profile
 - Hierarchical structure (parent_agent_id for upline)
 - Agent levels: Advisor, Leader, Director, Agency
 - Custom branding per agent (logo, colors)
 - Unique enrollment code per agent
 - Commission eligibility toggle
 - Product access control
 - Activation/deactivation by admin
 - Agent search and filtering
 - Agent tree visualization (downline hierarchy)

 ### 4.3 PRODUCT MANAGEMENT
 Features to implement:
 - Create/edit products with:
   - Basic info (name, description, category, provider)
   - IUA levels (deductible amounts: $1000, $2500, $5000, etc.)
   - Age brackets (0-17, 18-29, 30-39, 40-49, 50-64, 65+)
   - Benefit types (Individual, Couple, Family)
   - Pricing matrix (price per IUA + age bracket + benefit type)
   - Vendor costs (for commission calculations)
   - Extra costs (setup fee, annual fee, tobacco surcharge)
   - Product benefits list (feature descriptions)
 - Product availability dates
 - Hide from public option
 - Enhanced pricing matrix editor UI

 ### 4.4 ENROLLMENT FLOW (4-Step Wizard)

 **Step 1: Plan Selection**
 - Select plan type: Member Only, Member + Spouse, Member + Children, Member + Family
 - Select IUA level (deductible)
 - Tobacco/smoker declaration
 - Calculate and display monthly cost
 - Age validation (65+ has enrollment restrictions)

 **Step 2: Personal Information**
 - First name, last name
 - Date of birth (with age calculation)
 - Gender
 - Email, phone
 - Pre-existing conditions declaration

 **Step 3: Address & Dependents**
 - Full address (street, apt, city, state, zip, country)
 - Add dependents based on plan type:
   - Spouse: name, DOB, gender, smoker status, conditions
   - Children: name, DOB, gender, conditions
 - Option for dependents to use different address

 **Step 4: Review & Submit**
 - Review all information
 - Legal documents with scroll tracking:
   - Terms and Conditions
   - Privacy Policy
   - Membership Guidelines
 - Digital signature capture (canvas-based SignaturePad)
 - Payment method selection:
   - Credit/Debit Card (via Accept.js tokenization)
   - ACH/eCheck (bank account)
 - Process payment (setup fee + annual fee + first month)
 - Generate and store enrollment contract

 ### 4.5 BILLING & PAYMENT SYSTEM

 **Payment Methods:**
 - Credit Card (Visa, MasterCard, Amex, Discover)
 - ACH/eCheck (bank routing + account number)

 **Authorize.Net Integration:**
 ```typescript
 // Required functions:
 1. createCustomerProfile(memberData) -> customerProfileId
 2. createPaymentProfile(customerProfileId, paymentData) -> paymentProfileId
 3. chargeCustomerProfile(customerProfileId, paymentProfileId, amount) -> transactionId
 4. createSubscription(customerProfileId, paymentProfileId, scheduleData) -> subscriptionId
 5. getCustomerProfile(customerProfileId) -> profileDetails
 6. updatePaymentProfile(customerProfileId, paymentProfileId, newData)
 7. deletePaymentProfile(customerProfileId, paymentProfileId)
 8. voidTransaction(transactionId) // same day only
 9. refundTransaction(transactionId, amount)
 ```

 **Billing Schedules:**
 - Monthly billing (recurring subscription)
 - Annual billing (yearly renewal)
 - One-time charges (setup fees)
 - Failed payment tracking
 - Automatic retry logic (configurable delays)

 **Payment Retry Logic:**
 ```typescript
 // Retry configuration:
 const RETRY_DELAYS = [1, 3, 5, 7]; // days
 const MAX_RETRIES = 4;
 // After max retries: mark as abandoned, notify admin, send member notification
 ```

 ### 4.6 COMMISSION SYSTEM

 **Commission Types:**
 - Signup Commission: One-time payment on new enrollment
 - Monthly Commission: Recurring payment per active member
 - Override Commission: Additional commission for managers on downline sales

 **Commission Calculation:**
 ```typescript
 // Commission = (Monthly Price - Vendor Cost) * Commission Rate
 // Rates vary by:
 // - Agent Level (Advisor, Leader, Director, Agency)
 // - Plan Type (Member Only, +Spouse, +Children, +Family)
 // - Product
 ```

 **Commission Reporting:**
 - Filter by agent, date range, product
 - Show breakdown by commission type
 - Payment date: 25th of each month
 - CSV export

 ### 4.7 ENROLLMENT LINK TRACKING

 **Features:**
 - Create custom tracking links per agent
 - UTM parameter support (source, medium, campaign, term, content)
 - Track visits with:
   - IP address, user agent, referrer
   - Device type, browser, OS
   - Country, city (via IP geolocation)
 - Track conversions (visit -> enrollment)
 - Calculate conversion rates
 - Time-to-convert analytics

 ### 4.8 EMAIL NOTIFICATIONS (via Resend)

 **Email Types:**
 1. Welcome Email - On successful enrollment
 2. Payment Failure Notification - On failed payment
 3. Cancellation Email - On enrollment cancellation
 4. Agent Invitation - New agent signup link
 5. Admin Invitation - New admin user invite
 6. Agreement Reminder - Follow-up for incomplete enrollments
 7. Payment Receipt - After successful payment

 **Email Tracking:**
 - Log all sent emails
 - Track status (sent, failed, pending)
 - Store transaction IDs

 ### 4.9 REPORTING & ANALYTICS

 **Dashboard Metrics:**
 - Total members, new members (this month)
 - Total enrollments, active enrollments
 - Revenue (this month, total)
 - Pending payments, failed payments
 - Top performing agents

 **Report Types:**
 - Enrollment Analytics: By product, agent, status, date
 - Commission Report: By agent, level, product
 - Vendor Cost Report: Cost vs revenue analysis
 - Billing Report: Payment status, failures
 - Enrollment Logs: Full audit trail

 ### 4.10 SYSTEM SETTINGS

 **Configurable Settings:**
 - Email notification recipients
 - System email domains (for admin detection)
 - Payment retry configuration
 - Commission payment date
 - Default product settings
 - Enrollment restrictions

 ---

 ## PART 5: UI COMPONENTS

 ### 5.1 Layout Components
 ```
 Layout.tsx           - Main admin layout wrapper
 Sidebar.tsx          - Admin navigation sidebar
 TopNav.tsx           - Header with user menu, notifications
 AgentLayout.tsx      - Agent portal layout wrapper
 AgentSidebar.tsx     - Agent navigation sidebar
 AgentTopNav.tsx      - Agent header
 ```

 ### 5.2 Enrollment Components
 ```
 PersonalInfoForm.tsx     - Step 2 form
 AddressDependentsForm.tsx - Step 3 form
 PlanSelectionForm.tsx    - Step 1 form
 ReviewSubmitForm.tsx     - Step 4 form with payment
 ```

 ### 5.3 Payment Components
 ```
 CreditCardForm.tsx       - Credit card input with Accept.js
 ACHPaymentForm.tsx       - Bank account input
 AddPaymentMethodModal.tsx - Modal for adding payment methods
 BillingHistoryTable.tsx  - Payment history display
 ```

 ### 5.4 Utility Components
 ```
 ProtectedRoute.tsx       - Route authorization wrapper
 AddDependentModal.tsx    - Add/edit dependent modal
 SignaturePad.tsx         - Canvas-based signature capture
 ScrollTrackingModal.tsx  - Track document reading progress
 EnrollmentContractDownload.tsx - Download generated contracts
 AgentTreeNode.tsx        - Recursive agent hierarchy display
 MemberNotes.tsx          - Notes/comments component
 LanguageSwitcher.tsx     - Language toggle (EN/PT)
 EnhancedPricingMatrix.tsx - Product pricing editor
 DeleteUserButton.tsx     - User deletion with confirmation
 RootRedirect.tsx         - Handle root URL routing
 ```

 ---

 ## PART 6: SUPABASE EDGE FUNCTIONS

 Create the following Edge Functions:

 ### Payment Functions
 ```
 payment                     - Main payment processing
   - createCustomerProfile
   - createPaymentProfile
   - chargeProfile
   - createSubscription
   - getProfile
   - updateProfile
   - deleteProfile
   - void/refund
 payment-webhook             - Authorize.Net webhook handler
 process-recurring-payments  - Run recurring charges
 billing-processor           - Monthly billing execution
 ```

 ### Email Functions
 ```
 send-welcome-email          - Welcome on enrollment
 send-payment-failure-notification - Payment failed alert
 send-cancellation-email     - Cancellation notification
 send-agent-invitation       - Agent signup invite
 send-user-invitation        - Admin user invite
 send-agreement-reminder     - Incomplete enrollment reminder
 send-payment-receipt        - Payment confirmation
 notify-new-enrollment       - Admin notification
 ```

 ### User Management Functions
 ```
 check-auth-user            - Verify user authentication
 activate-admin-account     - Admin activation
 reset-user-password        - Password reset
 sync-user-metadata         - Sync user data
 track-user-signin          - Login tracking
 ```

 ### Utility Functions
 ```
 generate-enrollment-contract - Generate PDF contract
 update-enrollment-statuses   - Status cron job
 commission-processor         - Monthly commission calculation
 export-enrollments-csv       - Data export
 ```

 ---

 ## PART 7: SERVICE LAYER

 ### 7.1 Payment Service (payment.ts)
 ```typescript
 interface PaymentService {
   createCustomerProfile(member: Member): Promise<string>;
   createPaymentProfile(customerId: string, payment: PaymentData): Promise<string>;
   chargeProfile(customerId: string, paymentId: string, amount: number): Promise<Transaction>;
   setupRecurringBilling(enrollment: Enrollment): Promise<void>;
   retryFailedPayment(billingId: string): Promise<boolean>;
   processRefund(transactionId: string, amount: number): Promise<void>;
 }
 ```

 ### 7.2 Billing Service (billingService.ts)
 ```typescript
 interface BillingService {
   createBillingSchedule(enrollment: Enrollment): Promise<BillingSchedule>;
   processMonthlyBilling(): Promise<BillingResult[]>;
   handleFailedPayment(billing: Billing): Promise<void>;
   pauseBillingSchedule(scheduleId: string): Promise<void>;
   resumeBillingSchedule(scheduleId: string): Promise<void>;
   cancelBillingSchedule(scheduleId: string): Promise<void>;
 }
 ```

 ### 7.3 Commission Service (commissionService.ts)
 ```typescript
 interface CommissionService {
   calculateCommission(enrollment: Enrollment): CommissionBreakdown;
   processMonthlyCommissions(): Promise<void>;
   getAgentCommissions(agentId: string, dateRange: DateRange): Promise<Commission[]>;
   getCommissionReport(filters: CommissionFilters): Promise<CommissionReport>;
 }
 ```

 ### 7.4 Email Service (emailService.ts)
 ```typescript
 interface EmailService {
   sendWelcomeEmail(member: Member, enrollment: Enrollment): Promise<void>;
   sendPaymentFailureNotification(member: Member, error: string): Promise<void>;
   sendCancellationEmail(member: Member, reason: string): Promise<void>;
   sendAgentInvitation(email: string, agentId: string): Promise<void>;
   sendPaymentReceipt(member: Member, transaction: Transaction): Promise<void>;
 }
 ```

 ### 7.5 Enrollment Link Service (enrollmentLinkService.ts)
 ```typescript
 interface EnrollmentLinkService {
   createLink(agent: Agent, linkData: LinkData): Promise<EnrollmentLink>;
   trackVisit(linkId: string, visitData: VisitData): Promise<void>;
   trackConversion(visitId: string, enrollmentId: string): Promise<void>;
   getAnalytics(linkId: string): Promise<LinkAnalytics>;
   getAgentLinks(agentId: string): Promise<EnrollmentLink[]>;
 }
 ```

 ### 7.6 Enrollment Logger (enrollmentLogger.ts)
 ```typescript
 interface EnrollmentLogger {
   logAction(params: {
     enrollmentId?: string;
     memberId?: string;
     agentId?: string;
     action: string;
     statusBefore?: string;
     statusAfter?: string;
     details?: object;
     errorMessage?: string;
   }): Promise<void>;
 }
 ```

 ---

 ## PART 8: INTERNATIONALIZATION (i18n)

 ### 8.1 Languages
 - English (en) - Primary
 - Portuguese Brazilian (pt-BR) - Secondary

 ### 8.2 Translation Structure
 ```typescript
 // Namespaces:
 - common: General UI elements
 - auth: Authentication pages
 - members: Member management
 - agents: Agent management
 - products: Product pages
 - enrollment: Enrollment flow
 - billing: Billing & payments
 - reports: Reports & analytics
 - settings: Settings page
 - errors: Error messages
 - legal: Legal documents
 ```

 ### 8.3 Legal Content (Translated)
 - Terms and Conditions
 - Privacy Policy
 - Membership Guidelines
 - Enrollment Agreement

 ---

 ## PART 9: ENVIRONMENT VARIABLES

 ```env
 # Supabase
 VITE_SUPABASE_URL=https://your-project.supabase.co
 VITE_SUPABASE_ANON_KEY=your-anon-key
 VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

 # Authorize.Net
 VITE_AUTHORIZE_NET_API_LOGIN_ID=your-api-login-id
 VITE_AUTHORIZE_NET_TRANSACTION_KEY=your-transaction-key
 VITE_AUTHORIZE_NET_PUBLIC_CLIENT_KEY=your-public-client-key
 VITE_AUTHORIZE_NET_ENVIRONMENT=sandbox  # or production

 # Email (Resend - stored in Supabase secrets)
 RESEND_API_KEY=re_xxxxxxxx
 ```

 ---

 ## PART 10: DEPLOYMENT CHECKLIST

 ### 10.1 Database Setup
 - [ ] Create all tables in Supabase
 - [ ] Set up Row Level Security (RLS) policies
 - [ ] Create trigger functions (ID generation)
 - [ ] Create indexes for performance
 - [ ] Seed initial data (agent levels, benefit types)

 ### 10.2 Edge Functions
 - [ ] Deploy all Edge Functions
 - [ ] Set environment secrets (API keys)
 - [ ] Test webhook endpoints
 - [ ] Set up cron jobs (billing, status updates)

 ### 10.3 Authorize.Net
 - [ ] Create merchant account
 - [ ] Configure Accept.js
 - [ ] Set up webhook notifications
 - [ ] Test in sandbox mode
 - [ ] Switch to production

 ### 10.4 Email Setup
 - [ ] Create Resend account
 - [ ] Verify sending domain
 - [ ] Configure DNS records
 - [ ] Test email templates

 ### 10.5 Frontend
 - [ ] Configure environment variables
 - [ ] Build production bundle
 - [ ] Deploy to hosting (Vercel, Netlify, etc.)
 - [ ] Configure custom domain
 - [ ] Set up SSL certificate

 ---

 ## PART 11: KEY BUSINESS RULES

 ### 11.1 Enrollment Rules
 - Members must be under 65 at enrollment (or enroll 30+ days before turning 65)
 - Tobacco users pay additional surcharge
 - Dependents must meet age requirements for their relationship type
 - Pre-existing conditions must be disclosed

 ### 11.2 Billing Rules
 - Initial payment includes: Setup fee + Annual fee + First month
 - Monthly billing on the same day each month
 - Failed payments retry on days: 1, 3, 5, 7
 - After 4 failed attempts: pause billing, notify admin

 ### 11.3 Commission Rules
 - Commissions calculated on (Price - Vendor Cost)
 - Different rates per agent level
 - Paid on 25th of each month
 - Only for commission-eligible agents
 - Override commissions for managers on downline sales

 ### 11.4 Agent Rules
 - Agents must be activated by admin to log in
 - Each agent has unique enrollment code
 - Agents can only see their own members/enrollments
 - Parent agents can see downline performance
 ```

 ---

 ## SUMMARY

 This system provides:

 1. **Complete Member CRM** - Full lifecycle management from lead to active member
 2. **Hierarchical Agent Network** - Multi-level agent structure with downline tracking
 3. **Flexible Product Catalog** - Matrix-based pricing with multiple variables
 4. **Secure Payment Processing** - Authorize.Net integration with recurring billing
 5. **Commission Management** - Multi-tier commission calculation and reporting
 6. **Enrollment Analytics** - Link tracking, conversion analytics, audit logs
 7. **Multi-language Support** - English and Portuguese localization
 8. **Email Automation** - Triggered emails for key events
 9. **Role-based Access** - Separate admin and agent portals
 10. **Full Audit Trail** - Comprehensive logging of all actions

 The system is designed for health insurance enrollment but can be adapted for any subscription-based enrollment system with agent/broker 
 networks.

