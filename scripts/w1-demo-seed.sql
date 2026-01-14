-- ============================================================================
-- W1 Demo Seed Data
-- Sample data for all core CRM modules: Leads, Contacts, Accounts, Deals
-- ============================================================================

-- NOTE: Run this after creating an organization and user
-- Replace 'YOUR_ORG_ID' with your actual organization UUID
-- Replace 'YOUR_PROFILE_ID' with your actual profile UUID

-- For local development, you can use these example UUIDs
-- (or get them from your Supabase dashboard)

DO $$
DECLARE
  v_org_id uuid;
  v_profile_id uuid;
  v_leads_module_id uuid;
  v_contacts_module_id uuid;
  v_accounts_module_id uuid;
  v_deals_module_id uuid;
  v_lead_record_id uuid;
  v_contact_record_id uuid;
  v_account_record_id uuid;
  v_deal_record_id uuid;
BEGIN
  -- Get the first organization (for demo purposes)
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found. Please create an organization first.';
    RETURN;
  END IF;
  
  -- Get the first profile for this org
  SELECT id INTO v_profile_id FROM profiles WHERE organization_id = v_org_id LIMIT 1;
  
  IF v_profile_id IS NULL THEN
    RAISE NOTICE 'No profile found. Please create a profile first.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Seeding data for org_id: %, profile_id: %', v_org_id, v_profile_id;
  
  -- ============================================================================
  -- SEED DEFAULT DEAL STAGES
  -- ============================================================================
  PERFORM seed_default_deal_stages(v_org_id);
  
  -- ============================================================================
  -- CREATE CORE MODULES IF NOT EXISTS
  -- ============================================================================
  
  -- Leads Module
  INSERT INTO crm_modules (org_id, key, name, name_plural, icon, description, is_system, is_enabled, display_order)
  VALUES (v_org_id, 'leads', 'Lead', 'Leads', 'user-plus', 'Track potential customers', true, true, 1)
  ON CONFLICT (org_id, key) DO NOTHING
  RETURNING id INTO v_leads_module_id;
  
  IF v_leads_module_id IS NULL THEN
    SELECT id INTO v_leads_module_id FROM crm_modules WHERE org_id = v_org_id AND key = 'leads';
  END IF;
  
  -- Contacts Module
  INSERT INTO crm_modules (org_id, key, name, name_plural, icon, description, is_system, is_enabled, display_order)
  VALUES (v_org_id, 'contacts', 'Contact', 'Contacts', 'users', 'Manage your contacts', true, true, 2)
  ON CONFLICT (org_id, key) DO NOTHING
  RETURNING id INTO v_contacts_module_id;
  
  IF v_contacts_module_id IS NULL THEN
    SELECT id INTO v_contacts_module_id FROM crm_modules WHERE org_id = v_org_id AND key = 'contacts';
  END IF;
  
  -- Accounts Module
  INSERT INTO crm_modules (org_id, key, name, name_plural, icon, description, is_system, is_enabled, display_order)
  VALUES (v_org_id, 'accounts', 'Account', 'Accounts', 'building', 'Track companies and organizations', true, true, 3)
  ON CONFLICT (org_id, key) DO NOTHING
  RETURNING id INTO v_accounts_module_id;
  
  IF v_accounts_module_id IS NULL THEN
    SELECT id INTO v_accounts_module_id FROM crm_modules WHERE org_id = v_org_id AND key = 'accounts';
  END IF;
  
  -- Deals Module
  INSERT INTO crm_modules (org_id, key, name, name_plural, icon, description, is_system, is_enabled, display_order)
  VALUES (v_org_id, 'deals', 'Deal', 'Deals', 'dollar-sign', 'Manage sales pipeline', true, true, 4)
  ON CONFLICT (org_id, key) DO NOTHING
  RETURNING id INTO v_deals_module_id;
  
  IF v_deals_module_id IS NULL THEN
    SELECT id INTO v_deals_module_id FROM crm_modules WHERE org_id = v_org_id AND key = 'deals';
  END IF;
  
  -- ============================================================================
  -- SEED SAMPLE LEADS (20)
  -- ============================================================================
  
  INSERT INTO crm_records (org_id, module_id, owner_id, title, status, email, phone, data, created_by)
  VALUES
    (v_org_id, v_leads_module_id, v_profile_id, 'John Smith', 'New', 'john.smith@example.com', '555-0101', 
     '{"first_name": "John", "last_name": "Smith", "company": "TechCorp", "source": "Website", "industry": "Technology"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Sarah Johnson', 'Contacted', 'sarah.j@startup.io', '555-0102',
     '{"first_name": "Sarah", "last_name": "Johnson", "company": "Startup.io", "source": "LinkedIn", "industry": "SaaS"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Michael Brown', 'Qualified', 'mbrown@enterprise.com', '555-0103',
     '{"first_name": "Michael", "last_name": "Brown", "company": "Enterprise Co", "source": "Referral", "industry": "Finance"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Emily Davis', 'New', 'emily.d@medtech.org', '555-0104',
     '{"first_name": "Emily", "last_name": "Davis", "company": "MedTech Solutions", "source": "Conference", "industry": "Healthcare"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'David Wilson', 'Contacted', 'dwilson@globalcorp.com', '555-0105',
     '{"first_name": "David", "last_name": "Wilson", "company": "Global Corp", "source": "Cold Call", "industry": "Manufacturing"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Jessica Martinez', 'New', 'jmartinez@retail.co', '555-0106',
     '{"first_name": "Jessica", "last_name": "Martinez", "company": "Retail Plus", "source": "Trade Show", "industry": "Retail"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Robert Taylor', 'Qualified', 'rtaylor@finserv.com', '555-0107',
     '{"first_name": "Robert", "last_name": "Taylor", "company": "FinServ Partners", "source": "Website", "industry": "Financial Services"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Amanda Anderson', 'New', 'aanderson@healthnet.org', '555-0108',
     '{"first_name": "Amanda", "last_name": "Anderson", "company": "HealthNet", "source": "Webinar", "industry": "Healthcare"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Christopher Lee', 'Contacted', 'clee@autotech.io', '555-0109',
     '{"first_name": "Christopher", "last_name": "Lee", "company": "AutoTech", "source": "Partner", "industry": "Automotive"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Jennifer White', 'New', 'jwhite@edulearn.com', '555-0110',
     '{"first_name": "Jennifer", "last_name": "White", "company": "EduLearn", "source": "Content", "industry": "Education"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Daniel Harris', 'Qualified', 'dharris@logistico.com', '555-0111',
     '{"first_name": "Daniel", "last_name": "Harris", "company": "Logistico", "source": "Referral", "industry": "Logistics"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Michelle Clark', 'New', 'mclark@proptech.co', '555-0112',
     '{"first_name": "Michelle", "last_name": "Clark", "company": "PropTech", "source": "Website", "industry": "Real Estate"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'James Lewis', 'Contacted', 'jlewis@energyco.com', '555-0113',
     '{"first_name": "James", "last_name": "Lewis", "company": "Energy Co", "source": "Conference", "industry": "Energy"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Patricia Walker', 'New', 'pwalker@foodservice.com', '555-0114',
     '{"first_name": "Patricia", "last_name": "Walker", "company": "FoodService Inc", "source": "Cold Call", "industry": "Food & Beverage"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Thomas Hall', 'Qualified', 'thall@telecomplus.com', '555-0115',
     '{"first_name": "Thomas", "last_name": "Hall", "company": "Telecom Plus", "source": "Partner", "industry": "Telecommunications"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Lisa Young', 'New', 'lyoung@creativeco.com', '555-0116',
     '{"first_name": "Lisa", "last_name": "Young", "company": "Creative Co", "source": "LinkedIn", "industry": "Marketing"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Kevin King', 'Contacted', 'kking@constructco.com', '555-0117',
     '{"first_name": "Kevin", "last_name": "King", "company": "Construct Co", "source": "Trade Show", "industry": "Construction"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Nancy Wright', 'New', 'nwright@lawfirm.com', '555-0118',
     '{"first_name": "Nancy", "last_name": "Wright", "company": "Wright & Associates", "source": "Referral", "industry": "Legal"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Brian Scott', 'Qualified', 'bscott@insurepro.com', '555-0119',
     '{"first_name": "Brian", "last_name": "Scott", "company": "InsurePro", "source": "Webinar", "industry": "Insurance"}'::jsonb, v_profile_id),
    (v_org_id, v_leads_module_id, v_profile_id, 'Karen Green', 'New', 'kgreen@pharmaco.com', '555-0120',
     '{"first_name": "Karen", "last_name": "Green", "company": "PharmaCo", "source": "Website", "industry": "Pharmaceutical"}'::jsonb, v_profile_id);
  
  -- ============================================================================
  -- SEED SAMPLE ACCOUNTS (10)
  -- ============================================================================
  
  INSERT INTO crm_records (org_id, module_id, owner_id, title, status, phone, data, created_by)
  VALUES
    (v_org_id, v_accounts_module_id, v_profile_id, 'Acme Corporation', 'Active', '555-1001',
     '{"company_name": "Acme Corporation", "industry": "Manufacturing", "employees": 500, "annual_revenue": 50000000, "website": "https://acme.com", "address": "123 Industrial Ave, Chicago, IL"}'::jsonb, v_profile_id),
    (v_org_id, v_accounts_module_id, v_profile_id, 'TechStart Inc', 'Active', '555-1002',
     '{"company_name": "TechStart Inc", "industry": "Technology", "employees": 150, "annual_revenue": 15000000, "website": "https://techstart.io", "address": "456 Innovation Way, San Francisco, CA"}'::jsonb, v_profile_id),
    (v_org_id, v_accounts_module_id, v_profile_id, 'Global Finance Partners', 'Active', '555-1003',
     '{"company_name": "Global Finance Partners", "industry": "Financial Services", "employees": 1200, "annual_revenue": 200000000, "website": "https://gfpartners.com", "address": "789 Wall Street, New York, NY"}'::jsonb, v_profile_id),
    (v_org_id, v_accounts_module_id, v_profile_id, 'HealthFirst Medical', 'Active', '555-1004',
     '{"company_name": "HealthFirst Medical", "industry": "Healthcare", "employees": 800, "annual_revenue": 75000000, "website": "https://healthfirst.org", "address": "321 Medical Center Dr, Boston, MA"}'::jsonb, v_profile_id),
    (v_org_id, v_accounts_module_id, v_profile_id, 'RetailMax Group', 'Active', '555-1005',
     '{"company_name": "RetailMax Group", "industry": "Retail", "employees": 2500, "annual_revenue": 300000000, "website": "https://retailmax.com", "address": "555 Commerce Blvd, Dallas, TX"}'::jsonb, v_profile_id),
    (v_org_id, v_accounts_module_id, v_profile_id, 'EduTech Solutions', 'Prospect', '555-1006',
     '{"company_name": "EduTech Solutions", "industry": "Education", "employees": 100, "annual_revenue": 8000000, "website": "https://edutech.co", "address": "888 Learning Lane, Austin, TX"}'::jsonb, v_profile_id),
    (v_org_id, v_accounts_module_id, v_profile_id, 'GreenEnergy Corp', 'Active', '555-1007',
     '{"company_name": "GreenEnergy Corp", "industry": "Energy", "employees": 350, "annual_revenue": 45000000, "website": "https://greenenergy.com", "address": "777 Solar Ave, Denver, CO"}'::jsonb, v_profile_id),
    (v_org_id, v_accounts_module_id, v_profile_id, 'LogiTrans Worldwide', 'Active', '555-1008',
     '{"company_name": "LogiTrans Worldwide", "industry": "Logistics", "employees": 1800, "annual_revenue": 150000000, "website": "https://logitrans.com", "address": "999 Freight Way, Atlanta, GA"}'::jsonb, v_profile_id),
    (v_org_id, v_accounts_module_id, v_profile_id, 'MediaPro Agency', 'Prospect', '555-1009',
     '{"company_name": "MediaPro Agency", "industry": "Marketing", "employees": 75, "annual_revenue": 5000000, "website": "https://mediapro.agency", "address": "111 Creative St, Los Angeles, CA"}'::jsonb, v_profile_id),
    (v_org_id, v_accounts_module_id, v_profile_id, 'BuildRight Construction', 'Active', '555-1010',
     '{"company_name": "BuildRight Construction", "industry": "Construction", "employees": 600, "annual_revenue": 80000000, "website": "https://buildright.com", "address": "222 Builder Rd, Phoenix, AZ"}'::jsonb, v_profile_id);
  
  -- ============================================================================
  -- SEED SAMPLE CONTACTS (15)
  -- ============================================================================
  
  INSERT INTO crm_records (org_id, module_id, owner_id, title, status, email, phone, data, created_by)
  VALUES
    (v_org_id, v_contacts_module_id, v_profile_id, 'Alice Johnson', 'Active', 'alice.johnson@acme.com', '555-2001',
     '{"first_name": "Alice", "last_name": "Johnson", "job_title": "CEO", "company": "Acme Corporation", "department": "Executive"}'::jsonb, v_profile_id),
    (v_org_id, v_contacts_module_id, v_profile_id, 'Bob Williams', 'Active', 'bob.w@techstart.io', '555-2002',
     '{"first_name": "Bob", "last_name": "Williams", "job_title": "CTO", "company": "TechStart Inc", "department": "Technology"}'::jsonb, v_profile_id),
    (v_org_id, v_contacts_module_id, v_profile_id, 'Carol Davis', 'Active', 'cdavis@gfpartners.com', '555-2003',
     '{"first_name": "Carol", "last_name": "Davis", "job_title": "VP of Sales", "company": "Global Finance Partners", "department": "Sales"}'::jsonb, v_profile_id),
    (v_org_id, v_contacts_module_id, v_profile_id, 'Dan Miller', 'Active', 'dmiller@healthfirst.org', '555-2004',
     '{"first_name": "Dan", "last_name": "Miller", "job_title": "Operations Manager", "company": "HealthFirst Medical", "department": "Operations"}'::jsonb, v_profile_id),
    (v_org_id, v_contacts_module_id, v_profile_id, 'Eve Thompson', 'Active', 'ethompson@retailmax.com', '555-2005',
     '{"first_name": "Eve", "last_name": "Thompson", "job_title": "Procurement Director", "company": "RetailMax Group", "department": "Procurement"}'::jsonb, v_profile_id),
    (v_org_id, v_contacts_module_id, v_profile_id, 'Frank Garcia', 'Active', 'fgarcia@acme.com', '555-2006',
     '{"first_name": "Frank", "last_name": "Garcia", "job_title": "CFO", "company": "Acme Corporation", "department": "Finance"}'::jsonb, v_profile_id),
    (v_org_id, v_contacts_module_id, v_profile_id, 'Grace Lee', 'Active', 'glee@techstart.io', '555-2007',
     '{"first_name": "Grace", "last_name": "Lee", "job_title": "Product Manager", "company": "TechStart Inc", "department": "Product"}'::jsonb, v_profile_id),
    (v_org_id, v_contacts_module_id, v_profile_id, 'Henry Brown', 'Active', 'hbrown@gfpartners.com', '555-2008',
     '{"first_name": "Henry", "last_name": "Brown", "job_title": "IT Director", "company": "Global Finance Partners", "department": "IT"}'::jsonb, v_profile_id),
    (v_org_id, v_contacts_module_id, v_profile_id, 'Ivy Chen', 'Active', 'ichen@edutech.co', '555-2009',
     '{"first_name": "Ivy", "last_name": "Chen", "job_title": "Founder", "company": "EduTech Solutions", "department": "Executive"}'::jsonb, v_profile_id),
    (v_org_id, v_contacts_module_id, v_profile_id, 'Jack Martin', 'Active', 'jmartin@greenenergy.com', '555-2010',
     '{"first_name": "Jack", "last_name": "Martin", "job_title": "VP Engineering", "company": "GreenEnergy Corp", "department": "Engineering"}'::jsonb, v_profile_id),
    (v_org_id, v_contacts_module_id, v_profile_id, 'Kate Wilson', 'Active', 'kwilson@logitrans.com', '555-2011',
     '{"first_name": "Kate", "last_name": "Wilson", "job_title": "COO", "company": "LogiTrans Worldwide", "department": "Operations"}'::jsonb, v_profile_id),
    (v_org_id, v_contacts_module_id, v_profile_id, 'Leo Adams', 'Active', 'ladams@mediapro.agency', '555-2012',
     '{"first_name": "Leo", "last_name": "Adams", "job_title": "Creative Director", "company": "MediaPro Agency", "department": "Creative"}'::jsonb, v_profile_id),
    (v_org_id, v_contacts_module_id, v_profile_id, 'Mia Roberts', 'Active', 'mroberts@buildright.com', '555-2013',
     '{"first_name": "Mia", "last_name": "Roberts", "job_title": "Project Manager", "company": "BuildRight Construction", "department": "Projects"}'::jsonb, v_profile_id),
    (v_org_id, v_contacts_module_id, v_profile_id, 'Nick Taylor', 'Active', 'ntaylor@healthfirst.org', '555-2014',
     '{"first_name": "Nick", "last_name": "Taylor", "job_title": "HR Director", "company": "HealthFirst Medical", "department": "Human Resources"}'::jsonb, v_profile_id),
    (v_org_id, v_contacts_module_id, v_profile_id, 'Olivia Harris', 'Active', 'oharris@retailmax.com', '555-2015',
     '{"first_name": "Olivia", "last_name": "Harris", "job_title": "Marketing Manager", "company": "RetailMax Group", "department": "Marketing"}'::jsonb, v_profile_id);
  
  -- ============================================================================
  -- SEED SAMPLE DEALS (8) across pipeline stages
  -- ============================================================================
  
  INSERT INTO crm_records (org_id, module_id, owner_id, title, status, stage, data, created_by)
  VALUES
    (v_org_id, v_deals_module_id, v_profile_id, 'Acme Enterprise License', 'Open', 'qualification',
     '{"deal_name": "Acme Enterprise License", "amount": 75000, "probability": 10, "expected_close_date": "2026-03-15", "type": "New Business"}'::jsonb, v_profile_id),
    (v_org_id, v_deals_module_id, v_profile_id, 'TechStart Platform Upgrade', 'Open', 'needs_analysis',
     '{"deal_name": "TechStart Platform Upgrade", "amount": 45000, "probability": 25, "expected_close_date": "2026-02-28", "type": "Upsell"}'::jsonb, v_profile_id),
    (v_org_id, v_deals_module_id, v_profile_id, 'Global Finance Integration', 'Open', 'proposal',
     '{"deal_name": "Global Finance Integration", "amount": 150000, "probability": 50, "expected_close_date": "2026-02-15", "type": "New Business"}'::jsonb, v_profile_id),
    (v_org_id, v_deals_module_id, v_profile_id, 'HealthFirst Annual Contract', 'Open', 'proposal',
     '{"deal_name": "HealthFirst Annual Contract", "amount": 85000, "probability": 50, "expected_close_date": "2026-01-31", "type": "Renewal"}'::jsonb, v_profile_id),
    (v_org_id, v_deals_module_id, v_profile_id, 'RetailMax POS System', 'Open', 'negotiation',
     '{"deal_name": "RetailMax POS System", "amount": 200000, "probability": 75, "expected_close_date": "2026-01-25", "type": "New Business"}'::jsonb, v_profile_id),
    (v_org_id, v_deals_module_id, v_profile_id, 'EduTech Pilot Program', 'Open', 'qualification',
     '{"deal_name": "EduTech Pilot Program", "amount": 15000, "probability": 10, "expected_close_date": "2026-04-01", "type": "New Business"}'::jsonb, v_profile_id),
    (v_org_id, v_deals_module_id, v_profile_id, 'GreenEnergy Monitoring Suite', 'Won', 'closed_won',
     '{"deal_name": "GreenEnergy Monitoring Suite", "amount": 60000, "probability": 100, "expected_close_date": "2026-01-10", "type": "New Business"}'::jsonb, v_profile_id),
    (v_org_id, v_deals_module_id, v_profile_id, 'LogiTrans Fleet Management', 'Open', 'needs_analysis',
     '{"deal_name": "LogiTrans Fleet Management", "amount": 120000, "probability": 25, "expected_close_date": "2026-03-01", "type": "New Business"}'::jsonb, v_profile_id);
  
  -- ============================================================================
  -- SEED SAMPLE ACTIVITIES
  -- ============================================================================
  
  -- Get a sample deal ID
  SELECT id INTO v_deal_record_id FROM crm_records WHERE module_id = v_deals_module_id AND org_id = v_org_id LIMIT 1;
  
  -- Get a sample contact ID
  SELECT id INTO v_contact_record_id FROM crm_records WHERE module_id = v_contacts_module_id AND org_id = v_org_id LIMIT 1;
  
  IF v_deal_record_id IS NOT NULL THEN
    INSERT INTO crm_tasks (org_id, record_id, title, description, activity_type, priority, status, assigned_to, created_by, due_at)
    VALUES
      (v_org_id, v_deal_record_id, 'Discovery call with stakeholders', 'Schedule initial discovery call to understand requirements', 'call', 'high', 'completed', v_profile_id, v_profile_id, NOW() - INTERVAL '3 days'),
      (v_org_id, v_deal_record_id, 'Send proposal document', 'Prepare and send detailed proposal with pricing', 'task', 'high', 'open', v_profile_id, v_profile_id, NOW() + INTERVAL '2 days'),
      (v_org_id, v_deal_record_id, 'Product demo meeting', 'Live demo of platform features', 'meeting', 'normal', 'open', v_profile_id, v_profile_id, NOW() + INTERVAL '5 days');
    
    -- Add some notes
    INSERT INTO crm_notes (org_id, record_id, body, is_pinned, created_by)
    VALUES
      (v_org_id, v_deal_record_id, 'Initial meeting went well. Customer is interested in the enterprise tier. Main concerns are around integration timeline and support SLAs.', true, v_profile_id),
      (v_org_id, v_deal_record_id, 'Follow-up call scheduled for next week. Need to prepare custom pricing proposal.', false, v_profile_id);
  END IF;
  
  IF v_contact_record_id IS NOT NULL THEN
    INSERT INTO crm_tasks (org_id, record_id, title, description, activity_type, priority, status, assigned_to, created_by, due_at, call_type, call_result)
    VALUES
      (v_org_id, v_contact_record_id, 'Quarterly check-in call', 'Regular check-in to discuss satisfaction and upcoming needs', 'call', 'normal', 'completed', v_profile_id, v_profile_id, NOW() - INTERVAL '1 week', 'outbound', 'connected'),
      (v_org_id, v_contact_record_id, 'Send product updates newsletter', 'Share latest product updates and features', 'email', 'low', 'completed', v_profile_id, v_profile_id, NOW() - INTERVAL '2 days');
  END IF;
  
  RAISE NOTICE 'Demo data seeded successfully!';
  RAISE NOTICE 'Created: 20 leads, 10 accounts, 15 contacts, 8 deals with activities and notes';
  
END $$;
