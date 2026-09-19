-- End of Life Planner Database Schema
-- All tables prefixed with 'tools_eolp_'
-- Matches UI: EndOfLifePlannerTool (one plan per person, tab/subsection chrome,
-- list records, personal extras, custom tabs, secret fields).
--
-- Recommended shape:
--   tools_eolp_plans              one row per person plan
--   tools_eolp_sections           built-in + custom tabs (complete / inactive / order / notes)
--   tools_eolp_subsections        dotted-rule blocks (rename / inactivate)
--   tools_eolp_personal_blocks    duplicated Personal Record subsections
--   1:1 content tables            personal, home, eol_wishes, my_wishes
--   child list tables             contacts, devices, accounts, documents, etc.
--   tools_eolp_default_next_steps read-only catalog copied onto each new plan
--
-- Secret columns end in _secret and stay TEXT for now. App-layer encryption
-- can wrap these later without changing the table shape.
--
-- Run in Supabase SQL Editor (idempotent: safe to re-run).
-- After deploy, add tool_id FK indexes to add-performance-indexes.sql if you maintain that file.

-- ============================================================================
-- SHARED HELPERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_tools_eolp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION apply_tools_eolp_owner_rls(p_table text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table);

  -- Policy names are identifiers and must be double-quoted (%I), not string literals (%L).
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'eolp: Users can view their own rows', p_table);
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING ((select auth.uid()) = user_id)',
    'eolp: Users can view their own rows', p_table
  );

  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'eolp: Users can insert their own rows', p_table);
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id)',
    'eolp: Users can insert their own rows', p_table
  );

  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'eolp: Users can update their own rows', p_table);
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)',
    'eolp: Users can update their own rows', p_table
  );

  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'eolp: Users can delete their own rows', p_table);
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING ((select auth.uid()) = user_id)',
    'eolp: Users can delete their own rows', p_table
  );
END;
$$;

-- ============================================================================
-- DEFAULT NEXT STEPS (read-only catalog)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_eolp_default_next_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO tools_eolp_default_next_steps (seed_key, title, priority, display_order) VALUES
  ('contact-spouse', 'Contact my spouse/family', 'High', 10),
  ('contact-executor', 'Contact executor/personal representative', 'High', 20),
  ('contact-attorney', 'Contact attorney', 'High', 30),
  ('locate-will', 'Locate my will', 'High', 40),
  ('locate-directive', 'Locate healthcare directive', 'High', 50),
  ('contact-life-insurance', 'Contact life insurance companies', 'High', 60),
  ('notify-employer', 'Notify employer', 'Medium', 70),
  ('contact-advisor', 'Contact financial advisor', 'Medium', 80),
  ('contact-ssa', 'Contact Social Security if applicable', 'Medium', 90),
  ('contact-pension', 'Contact pension/retirement administrator', 'Medium', 100),
  ('secure-devices', 'Secure my phone/computers', 'High', 110),
  ('secure-home', 'Secure my home', 'High', 120),
  ('care-pets', 'Take care of pets', 'High', 130),
  ('review-autopay', 'Review automatic payments', 'Medium', 140),
  ('review-bills', 'Review upcoming bills', 'Medium', 150),
  ('cancel-subs', 'Cancel unnecessary subscriptions', 'Low', 160),
  ('secure-valuables', 'Secure physical valuables', 'Medium', 170),
  ('contact-funeral', 'Contact funeral home', 'High', 180),
  ('follow-funeral', 'Follow funeral/memorial instructions', 'High', 190),
  ('review-online', 'Review online accounts', 'Medium', 200),
  ('review-business', 'Review business responsibilities', 'Medium', 210)
ON CONFLICT (seed_key) DO UPDATE
SET title = EXCLUDED.title,
    priority = EXCLUDED.priority,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- ============================================================================
-- PLANS
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_eolp_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  person_full_name TEXT NOT NULL DEFAULT '',
  relationship TEXT NOT NULL DEFAULT '' CHECK (
    relationship IN ('', 'Spouse/partner', 'Self', 'Parent', 'Child', 'Other')
  ),
  relationship_custom TEXT NOT NULL DEFAULT '',
  date_of_birth DATE,
  card_color TEXT NOT NULL DEFAULT '#10b981',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived')),
  is_selected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  history_events JSONB NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE tools_eolp_plans
  ADD COLUMN IF NOT EXISTS history_events JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_eolp_plans_user_id ON tools_eolp_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_eolp_plans_tool_id ON tools_eolp_plans(tool_id);
CREATE INDEX IF NOT EXISTS idx_eolp_plans_user_tool ON tools_eolp_plans(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_eolp_plans_user_tool_status ON tools_eolp_plans(user_id, tool_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_eolp_plans_one_selected
  ON tools_eolp_plans(user_id, tool_id)
  WHERE is_selected = true;

-- ============================================================================
-- SECTIONS (built-in tabs + custom tabs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_eolp_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('builtin', 'custom')),
  builtin_key TEXT CHECK (
    builtin_key IS NULL OR builtin_key IN (
      'personal', 'contacts', 'devices', 'online', 'documents', 'insurance',
      'financial', 'home', 'nextSteps', 'eolWishes', 'myWishes', 'letters', 'other'
    )
  ),
  modeled_after TEXT CHECK (
    modeled_after IS NULL OR modeled_after IN (
      'contacts', 'devices', 'online', 'documents', 'insurance', 'letters', 'other'
    )
  ),
  name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  is_complete BOOLEAN NOT NULL DEFAULT false,
  is_inactive BOOLEAN NOT NULL DEFAULT false,
  is_removed BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT tools_eolp_sections_kind_keys CHECK (
    (kind = 'builtin' AND builtin_key IS NOT NULL AND modeled_after IS NULL)
    OR (kind = 'custom' AND builtin_key IS NULL AND modeled_after IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_eolp_sections_plan_id ON tools_eolp_sections(plan_id);
CREATE INDEX IF NOT EXISTS idx_eolp_sections_user_tool ON tools_eolp_sections(user_id, tool_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_eolp_sections_builtin_once
  ON tools_eolp_sections(plan_id, builtin_key)
  WHERE kind = 'builtin';

-- ============================================================================
-- SUBSECTIONS (dotted-rule headings: rename / inactivate)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_eolp_subsections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  section_id UUID REFERENCES tools_eolp_sections(id) ON DELETE CASCADE,
  subsection_key TEXT NOT NULL,
  name TEXT NOT NULL,
  is_inactive BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, subsection_key)
);

CREATE INDEX IF NOT EXISTS idx_eolp_subsections_plan_id ON tools_eolp_subsections(plan_id);
CREATE INDEX IF NOT EXISTS idx_eolp_subsections_section_id ON tools_eolp_subsections(section_id);

-- ============================================================================
-- PERSONAL RECORD (1:1 built-in Personal Information + ID / work / military)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_eolp_personal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL UNIQUE REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  full_legal_name TEXT NOT NULL DEFAULT '',
  preferred_name TEXT NOT NULL DEFAULT '',
  previous_names TEXT NOT NULL DEFAULT '',
  date_of_birth DATE,
  place_of_birth TEXT NOT NULL DEFAULT '',
  ssn_secret TEXT NOT NULL DEFAULT '',
  marital_status TEXT NOT NULL DEFAULT '',
  spouse_partner TEXT NOT NULL DEFAULT '',
  home_address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  personal_email TEXT NOT NULL DEFAULT '',
  drivers_license_number_secret TEXT NOT NULL DEFAULT '',
  drivers_license_state TEXT NOT NULL DEFAULT '',
  passport_number_secret TEXT NOT NULL DEFAULT '',
  passport_expiration DATE,
  other_identification TEXT NOT NULL DEFAULT '',
  employer TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL DEFAULT '',
  employer_contact TEXT NOT NULL DEFAULT '',
  hr_contact TEXT NOT NULL DEFAULT '',
  work_phone TEXT NOT NULL DEFAULT '',
  work_email TEXT NOT NULL DEFAULT '',
  veteran_status TEXT NOT NULL DEFAULT '',
  military_branch TEXT NOT NULL DEFAULT '',
  service_dates TEXT NOT NULL DEFAULT '',
  military_id TEXT NOT NULL DEFAULT '',
  discharge_records_location TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_personal_user_tool ON tools_eolp_personal(user_id, tool_id);

-- Duplicated Personal Record subsections (Identification, Employment, Military, Notes)
CREATE TABLE IF NOT EXISTS tools_eolp_personal_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('identification', 'employment', 'military', 'family', 'notes')),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  drivers_license_number_secret TEXT NOT NULL DEFAULT '',
  drivers_license_state TEXT NOT NULL DEFAULT '',
  passport_number_secret TEXT NOT NULL DEFAULT '',
  passport_expiration DATE,
  other_identification TEXT NOT NULL DEFAULT '',
  employer TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL DEFAULT '',
  employer_contact TEXT NOT NULL DEFAULT '',
  hr_contact TEXT NOT NULL DEFAULT '',
  work_phone TEXT NOT NULL DEFAULT '',
  work_email TEXT NOT NULL DEFAULT '',
  veteran_status TEXT NOT NULL DEFAULT '',
  military_branch TEXT NOT NULL DEFAULT '',
  service_dates TEXT NOT NULL DEFAULT '',
  military_id TEXT NOT NULL DEFAULT '',
  discharge_records_location TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_personal_blocks_plan_id ON tools_eolp_personal_blocks(plan_id);
CREATE INDEX IF NOT EXISTS idx_eolp_personal_blocks_plan_kind ON tools_eolp_personal_blocks(plan_id, kind);

CREATE TABLE IF NOT EXISTS tools_eolp_family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  personal_block_id UUID REFERENCES tools_eolp_personal_blocks(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  contact_info TEXT NOT NULL DEFAULT '',
  relationship TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_family_members_plan_id ON tools_eolp_family_members(plan_id);
CREATE INDEX IF NOT EXISTS idx_eolp_family_members_block_id ON tools_eolp_family_members(personal_block_id);

-- ============================================================================
-- CONTACTS / DEVICES / ONLINE / DOCUMENTS / INSURANCE
-- section_id is NULL for the built-in tab, or a custom section modeled after that tab
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_eolp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  section_id UUID REFERENCES tools_eolp_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  relationship TEXT NOT NULL DEFAULT '',
  contact_type TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  alternate_phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  why_contact TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 1 CHECK (priority >= 1),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_contacts_plan_id ON tools_eolp_contacts(plan_id);
CREATE INDEX IF NOT EXISTS idx_eolp_contacts_section_id ON tools_eolp_contacts(section_id);
CREATE INDEX IF NOT EXISTS idx_eolp_contacts_priority ON tools_eolp_contacts(plan_id, priority);

CREATE TABLE IF NOT EXISTS tools_eolp_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  section_id UUID REFERENCES tools_eolp_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT '',
  manufacturer TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  pin_secret TEXT NOT NULL DEFAULT '',
  password_secret TEXT NOT NULL DEFAULT '',
  recovery_key_secret TEXT NOT NULL DEFAULT '',
  associated_account TEXT NOT NULL DEFAULT '',
  access_instructions TEXT NOT NULL DEFAULT '',
  stored_information TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_devices_plan_id ON tools_eolp_devices(plan_id);
CREATE INDEX IF NOT EXISTS idx_eolp_devices_section_id ON tools_eolp_devices(section_id);

CREATE TABLE IF NOT EXISTS tools_eolp_online_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  section_id UUID REFERENCES tools_eolp_sections(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  password_secret TEXT NOT NULL DEFAULT '',
  mfa_enabled TEXT NOT NULL DEFAULT '' CHECK (mfa_enabled IN ('', 'yes', 'no')),
  mfa_method TEXT NOT NULL DEFAULT '',
  mfa_location_secret TEXT NOT NULL DEFAULT '',
  recovery_email_secret TEXT NOT NULL DEFAULT '',
  recovery_phone_secret TEXT NOT NULL DEFAULT '',
  account_reference TEXT NOT NULL DEFAULT '',
  disposition TEXT NOT NULL DEFAULT '',
  special_instructions TEXT NOT NULL DEFAULT '',
  password_stored_elsewhere TEXT NOT NULL DEFAULT '',
  password_stored_elsewhere_detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_online_accounts_plan_id ON tools_eolp_online_accounts(plan_id);
CREATE INDEX IF NOT EXISTS idx_eolp_online_accounts_section_id ON tools_eolp_online_accounts(section_id);

CREATE TABLE IF NOT EXISTS tools_eolp_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  section_id UUID REFERENCES tools_eolp_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  document_type TEXT NOT NULL DEFAULT '',
  original_or_copy TEXT NOT NULL DEFAULT '',
  physical_location TEXT NOT NULL DEFAULT '',
  digital_location TEXT NOT NULL DEFAULT '',
  who_has_copy TEXT NOT NULL DEFAULT '',
  attorney_contact TEXT NOT NULL DEFAULT '',
  date_created DATE,
  last_updated DATE,
  expiration_date DATE,
  special_instructions TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_documents_plan_id ON tools_eolp_documents(plan_id);
CREATE INDEX IF NOT EXISTS idx_eolp_documents_section_id ON tools_eolp_documents(section_id);

CREATE TABLE IF NOT EXISTS tools_eolp_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  section_id UUID REFERENCES tools_eolp_sections(id) ON DELETE CASCADE,
  company TEXT NOT NULL DEFAULT '',
  policy_type TEXT NOT NULL DEFAULT '',
  policy_number TEXT NOT NULL DEFAULT '',
  policyholder TEXT NOT NULL DEFAULT '',
  insured_person TEXT NOT NULL DEFAULT '',
  agent TEXT NOT NULL DEFAULT '',
  agent_contact TEXT NOT NULL DEFAULT '',
  beneficiary TEXT NOT NULL DEFAULT '',
  coverage_amount TEXT NOT NULL DEFAULT '',
  premium TEXT NOT NULL DEFAULT '',
  payment_frequency TEXT NOT NULL DEFAULT '',
  automatic_payment TEXT NOT NULL DEFAULT '' CHECK (automatic_payment IN ('', 'yes', 'no')),
  payment_account TEXT NOT NULL DEFAULT '',
  expiration_renewal TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  claim_contact TEXT NOT NULL DEFAULT '',
  document_location TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_insurance_plan_id ON tools_eolp_insurance(plan_id);
CREATE INDEX IF NOT EXISTS idx_eolp_insurance_section_id ON tools_eolp_insurance(section_id);

-- ============================================================================
-- FINANCIAL LISTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_eolp_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  institution TEXT NOT NULL DEFAULT '',
  account_type TEXT NOT NULL DEFAULT '',
  owners TEXT NOT NULL DEFAULT '',
  last_four TEXT NOT NULL DEFAULT '',
  joint_owner TEXT NOT NULL DEFAULT '',
  beneficiary TEXT NOT NULL DEFAULT '',
  bank_contact TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  login_storage TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_bank_accounts_plan_id ON tools_eolp_bank_accounts(plan_id);

CREATE TABLE IF NOT EXISTS tools_eolp_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  institution TEXT NOT NULL DEFAULT '',
  account_type TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  account_reference TEXT NOT NULL DEFAULT '',
  beneficiaries TEXT NOT NULL DEFAULT '',
  advisor TEXT NOT NULL DEFAULT '',
  website_login TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_investments_plan_id ON tools_eolp_investments(plan_id);

CREATE TABLE IF NOT EXISTS tools_eolp_credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  issuer TEXT NOT NULL DEFAULT '',
  card_type TEXT NOT NULL DEFAULT '',
  last_four TEXT NOT NULL DEFAULT '',
  primary_holder TEXT NOT NULL DEFAULT '',
  authorized_users TEXT NOT NULL DEFAULT '',
  automatic_payments TEXT NOT NULL DEFAULT '',
  balance_notes TEXT NOT NULL DEFAULT '',
  closing_instructions TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_credit_cards_plan_id ON tools_eolp_credit_cards(plan_id);

CREATE TABLE IF NOT EXISTS tools_eolp_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  creditor TEXT NOT NULL DEFAULT '',
  debt_type TEXT NOT NULL DEFAULT '',
  account_reference TEXT NOT NULL DEFAULT '',
  approximate_balance TEXT NOT NULL DEFAULT '',
  monthly_payment TEXT NOT NULL DEFAULT '',
  automatic_payment TEXT NOT NULL DEFAULT '',
  collateral TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_debts_plan_id ON tools_eolp_debts(plan_id);

CREATE TABLE IF NOT EXISTS tools_eolp_income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  income_type TEXT NOT NULL DEFAULT '',
  amount_frequency TEXT NOT NULL DEFAULT '',
  deposited_where TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  survivor_benefits TEXT NOT NULL DEFAULT '' CHECK (survivor_benefits IN ('', 'yes', 'no')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_income_sources_plan_id ON tools_eolp_income_sources(plan_id);

CREATE TABLE IF NOT EXISTS tools_eolp_recurring_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  company TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  amount TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  automatic_payment TEXT NOT NULL DEFAULT '' CHECK (automatic_payment IN ('', 'yes', 'no')),
  payment_account TEXT NOT NULL DEFAULT '',
  cancel_after_death TEXT NOT NULL DEFAULT '' CHECK (cancel_after_death IN ('', 'yes', 'no')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_recurring_bills_plan_id ON tools_eolp_recurring_bills(plan_id);

-- ============================================================================
-- HOME (1:1 property + access) and home lists
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_eolp_home (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL UNIQUE REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  address TEXT NOT NULL DEFAULT '',
  ownership_type TEXT NOT NULL DEFAULT '',
  other_owners TEXT NOT NULL DEFAULT '',
  mortgage_company TEXT NOT NULL DEFAULT '',
  mortgage_reference TEXT NOT NULL DEFAULT '',
  mortgage_balance TEXT NOT NULL DEFAULT '',
  monthly_payment TEXT NOT NULL DEFAULT '',
  property_tax TEXT NOT NULL DEFAULT '',
  homeowners_insurance TEXT NOT NULL DEFAULT '',
  deed_location TEXT NOT NULL DEFAULT '',
  garage_code_secret TEXT NOT NULL DEFAULT '',
  alarm_information_secret TEXT NOT NULL DEFAULT '',
  safe_location TEXT NOT NULL DEFAULT '',
  safe_instructions_secret TEXT NOT NULL DEFAULT '',
  spare_key_location TEXT NOT NULL DEFAULT '',
  mailbox_information TEXT NOT NULL DEFAULT '',
  camera_information TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_home_user_tool ON tools_eolp_home(user_id, tool_id);

CREATE TABLE IF NOT EXISTS tools_eolp_utilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  utility_type TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  account_reference TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  automatic_payment TEXT NOT NULL DEFAULT '',
  payment_source TEXT NOT NULL DEFAULT '',
  login_reference TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_utilities_plan_id ON tools_eolp_utilities(plan_id);

CREATE TABLE IF NOT EXISTS tools_eolp_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  account_reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_providers_plan_id ON tools_eolp_providers(plan_id);

CREATE TABLE IF NOT EXISTS tools_eolp_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  year TEXT NOT NULL DEFAULT '',
  make TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  vin TEXT NOT NULL DEFAULT '',
  loan_information TEXT NOT NULL DEFAULT '',
  title_location TEXT NOT NULL DEFAULT '',
  insurance TEXT NOT NULL DEFAULT '',
  spare_key_location TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_vehicles_plan_id ON tools_eolp_vehicles(plan_id);

-- ============================================================================
-- NEXT STEPS
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_eolp_next_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  seed_key TEXT,
  is_predefined BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  title TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  person_responsible TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  related_contact_id UUID REFERENCES tools_eolp_contacts(id) ON DELETE SET NULL,
  related_document TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Not started' CHECK (status IN ('Not started', 'Completed', 'Not applicable')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_next_steps_plan_id ON tools_eolp_next_steps(plan_id);
CREATE INDEX IF NOT EXISTS idx_eolp_next_steps_hidden ON tools_eolp_next_steps(plan_id, is_hidden);
CREATE UNIQUE INDEX IF NOT EXISTS idx_eolp_next_steps_seed
  ON tools_eolp_next_steps(plan_id, seed_key)
  WHERE seed_key IS NOT NULL;

-- ============================================================================
-- END OF LIFE WISHES + MY WISHES
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_eolp_eol_wishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL UNIQUE REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  disposition_preference TEXT NOT NULL DEFAULT '',
  funeral_home TEXT NOT NULL DEFAULT '',
  funeral_home_contact TEXT NOT NULL DEFAULT '',
  cemetery TEXT NOT NULL DEFAULT '',
  cemetery_plot TEXT NOT NULL DEFAULT '',
  paperwork_location TEXT NOT NULL DEFAULT '',
  funeral_service_desired TEXT NOT NULL DEFAULT '' CHECK (funeral_service_desired IN ('', 'yes', 'no')),
  memorial_service_desired TEXT NOT NULL DEFAULT '' CHECK (memorial_service_desired IN ('', 'yes', 'no')),
  religious_service TEXT NOT NULL DEFAULT '' CHECK (religious_service IN ('', 'yes', 'no')),
  clergy TEXT NOT NULL DEFAULT '',
  viewing TEXT NOT NULL DEFAULT '' CHECK (viewing IN ('', 'yes', 'no')),
  casket_preference TEXT NOT NULL DEFAULT '',
  preferred_location TEXT NOT NULL DEFAULT '',
  preferred_music TEXT NOT NULL DEFAULT '',
  preferred_readings TEXT NOT NULL DEFAULT '',
  preferred_speakers TEXT NOT NULL DEFAULT '',
  obituary_wishes TEXT NOT NULL DEFAULT '',
  people_to_notify TEXT NOT NULL DEFAULT '',
  organizations_to_notify TEXT NOT NULL DEFAULT '',
  flowers_preference TEXT NOT NULL DEFAULT '',
  memorial_donation TEXT NOT NULL DEFAULT '',
  pallbearer_preferences TEXT NOT NULL DEFAULT '',
  clothing_preference TEXT NOT NULL DEFAULT '',
  military_honors TEXT NOT NULL DEFAULT '',
  headstone_wishes TEXT NOT NULL DEFAULT '',
  ashes_instructions TEXT NOT NULL DEFAULT '',
  organ_donation_wishes TEXT NOT NULL DEFAULT '',
  prepaid_arrangements TEXT NOT NULL DEFAULT '',
  funeral_contract_location TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tools_eolp_my_wishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL UNIQUE REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  most_important TEXT NOT NULL DEFAULT '',
  family_to_know TEXT NOT NULL DEFAULT '',
  traditions TEXT NOT NULL DEFAULT '',
  special_belongings TEXT NOT NULL DEFAULT '',
  specific_gifts TEXT NOT NULL DEFAULT '',
  charitable_wishes TEXT NOT NULL DEFAULT '',
  important_organizations TEXT NOT NULL DEFAULT '',
  pets_care TEXT NOT NULL DEFAULT '',
  social_media TEXT NOT NULL DEFAULT '',
  digital_media TEXT NOT NULL DEFAULT '',
  collections TEXT NOT NULL DEFAULT '',
  personal_files TEXT NOT NULL DEFAULT '',
  phone_computer TEXT NOT NULL DEFAULT '',
  online_presence TEXT NOT NULL DEFAULT '',
  thanked_remembered TEXT NOT NULL DEFAULT '',
  do_not_want TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tools_eolp_personal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  item TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  photo_reference TEXT NOT NULL DEFAULT '',
  special_instructions TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_personal_items_plan_id ON tools_eolp_personal_items(plan_id);

-- ============================================================================
-- LETTERS + OTHER
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_eolp_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  section_id UUID REFERENCES tools_eolp_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL DEFAULT '',
  letter_type TEXT NOT NULL DEFAULT '',
  body_secret TEXT NOT NULL DEFAULT '',
  when_to_share TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Complete')),
  visibility TEXT NOT NULL DEFAULT 'Visible' CHECK (visibility IN ('Visible', 'Private')),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_letters_plan_id ON tools_eolp_letters(plan_id);
CREATE INDEX IF NOT EXISTS idx_eolp_letters_section_id ON tools_eolp_letters(section_id);

CREATE TABLE IF NOT EXISTS tools_eolp_other_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES tools_eolp_plans(id) ON DELETE CASCADE,
  section_id UUID REFERENCES tools_eolp_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  important_date DATE,
  contact TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  custom_notes TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_other_records_plan_id ON tools_eolp_other_records(plan_id);
CREATE INDEX IF NOT EXISTS idx_eolp_other_records_section_id ON tools_eolp_other_records(section_id);

CREATE TABLE IF NOT EXISTS tools_eolp_other_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES tools_eolp_other_records(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  value TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_other_custom_fields_record_id ON tools_eolp_other_custom_fields(record_id);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'tools_eolp_default_next_steps',
    'tools_eolp_plans',
    'tools_eolp_sections',
    'tools_eolp_subsections',
    'tools_eolp_personal',
    'tools_eolp_personal_blocks',
    'tools_eolp_family_members',
    'tools_eolp_contacts',
    'tools_eolp_devices',
    'tools_eolp_online_accounts',
    'tools_eolp_documents',
    'tools_eolp_insurance',
    'tools_eolp_bank_accounts',
    'tools_eolp_investments',
    'tools_eolp_credit_cards',
    'tools_eolp_debts',
    'tools_eolp_income_sources',
    'tools_eolp_recurring_bills',
    'tools_eolp_home',
    'tools_eolp_utilities',
    'tools_eolp_providers',
    'tools_eolp_vehicles',
    'tools_eolp_next_steps',
    'tools_eolp_eol_wishes',
    'tools_eolp_my_wishes',
    'tools_eolp_personal_items',
    'tools_eolp_letters',
    'tools_eolp_other_records',
    'tools_eolp_other_custom_fields'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_update_%s_updated_at ON %I', replace(tbl, 'tools_', ''), tbl);
    EXECUTE format(
      'CREATE TRIGGER trigger_update_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_tools_eolp_updated_at()',
      replace(tbl, 'tools_', ''),
      tbl
    );
  END LOOP;
END;
$$;

-- ============================================================================
-- SEED A NEW PLAN: built-in tabs, 1:1 rows, predefined next steps
-- ============================================================================
CREATE OR REPLACE FUNCTION tools_eolp_seed_new_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO tools_eolp_sections (
    user_id, tool_id, plan_id, kind, builtin_key, name, display_order
  ) VALUES
    (NEW.user_id, NEW.tool_id, NEW.id, 'builtin', 'personal', 'Personal Record', 10),
    (NEW.user_id, NEW.tool_id, NEW.id, 'builtin', 'contacts', 'Important Contacts', 20),
    (NEW.user_id, NEW.tool_id, NEW.id, 'builtin', 'devices', 'Device Login', 30),
    (NEW.user_id, NEW.tool_id, NEW.id, 'builtin', 'online', 'Online Login', 40),
    (NEW.user_id, NEW.tool_id, NEW.id, 'builtin', 'documents', 'Important Documents', 50),
    (NEW.user_id, NEW.tool_id, NEW.id, 'builtin', 'insurance', 'Insurance Information', 60),
    (NEW.user_id, NEW.tool_id, NEW.id, 'builtin', 'financial', 'Financial Info', 70),
    (NEW.user_id, NEW.tool_id, NEW.id, 'builtin', 'home', 'Home Info', 80),
    (NEW.user_id, NEW.tool_id, NEW.id, 'builtin', 'nextSteps', 'Next Steps', 90),
    (NEW.user_id, NEW.tool_id, NEW.id, 'builtin', 'eolWishes', 'End of Life Wishes', 100),
    (NEW.user_id, NEW.tool_id, NEW.id, 'builtin', 'myWishes', 'My Wishes', 110),
    (NEW.user_id, NEW.tool_id, NEW.id, 'builtin', 'letters', 'Letters', 120),
    (NEW.user_id, NEW.tool_id, NEW.id, 'builtin', 'other', 'Other', 130);

  INSERT INTO tools_eolp_personal (user_id, tool_id, plan_id) VALUES (NEW.user_id, NEW.tool_id, NEW.id);
  INSERT INTO tools_eolp_home (user_id, tool_id, plan_id) VALUES (NEW.user_id, NEW.tool_id, NEW.id);
  INSERT INTO tools_eolp_eol_wishes (user_id, tool_id, plan_id) VALUES (NEW.user_id, NEW.tool_id, NEW.id);
  INSERT INTO tools_eolp_my_wishes (user_id, tool_id, plan_id) VALUES (NEW.user_id, NEW.tool_id, NEW.id);

  INSERT INTO tools_eolp_next_steps (
    user_id, tool_id, plan_id, seed_key, is_predefined, title, priority, display_order
  )
  SELECT
    NEW.user_id,
    NEW.tool_id,
    NEW.id,
    d.seed_key,
    true,
    d.title,
    d.priority,
    d.display_order
  FROM tools_eolp_default_next_steps d
  ORDER BY d.display_order;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_eolp_seed_new_plan ON tools_eolp_plans;
CREATE TRIGGER trigger_eolp_seed_new_plan
  AFTER INSERT ON tools_eolp_plans
  FOR EACH ROW
  EXECUTE FUNCTION tools_eolp_seed_new_plan();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE tools_eolp_default_next_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eolp: Anyone can view default next steps" ON tools_eolp_default_next_steps;
CREATE POLICY "eolp: Anyone can view default next steps" ON tools_eolp_default_next_steps
  FOR SELECT TO authenticated USING (true);

SELECT apply_tools_eolp_owner_rls('tools_eolp_plans');
SELECT apply_tools_eolp_owner_rls('tools_eolp_sections');
SELECT apply_tools_eolp_owner_rls('tools_eolp_subsections');
SELECT apply_tools_eolp_owner_rls('tools_eolp_personal');
SELECT apply_tools_eolp_owner_rls('tools_eolp_personal_blocks');
SELECT apply_tools_eolp_owner_rls('tools_eolp_family_members');
SELECT apply_tools_eolp_owner_rls('tools_eolp_contacts');
SELECT apply_tools_eolp_owner_rls('tools_eolp_devices');
SELECT apply_tools_eolp_owner_rls('tools_eolp_online_accounts');
SELECT apply_tools_eolp_owner_rls('tools_eolp_documents');
SELECT apply_tools_eolp_owner_rls('tools_eolp_insurance');
SELECT apply_tools_eolp_owner_rls('tools_eolp_bank_accounts');
SELECT apply_tools_eolp_owner_rls('tools_eolp_investments');
SELECT apply_tools_eolp_owner_rls('tools_eolp_credit_cards');
SELECT apply_tools_eolp_owner_rls('tools_eolp_debts');
SELECT apply_tools_eolp_owner_rls('tools_eolp_income_sources');
SELECT apply_tools_eolp_owner_rls('tools_eolp_recurring_bills');
SELECT apply_tools_eolp_owner_rls('tools_eolp_home');
SELECT apply_tools_eolp_owner_rls('tools_eolp_utilities');
SELECT apply_tools_eolp_owner_rls('tools_eolp_providers');
SELECT apply_tools_eolp_owner_rls('tools_eolp_vehicles');
SELECT apply_tools_eolp_owner_rls('tools_eolp_next_steps');
SELECT apply_tools_eolp_owner_rls('tools_eolp_eol_wishes');
SELECT apply_tools_eolp_owner_rls('tools_eolp_my_wishes');
SELECT apply_tools_eolp_owner_rls('tools_eolp_personal_items');
SELECT apply_tools_eolp_owner_rls('tools_eolp_letters');
SELECT apply_tools_eolp_owner_rls('tools_eolp_other_records');
SELECT apply_tools_eolp_owner_rls('tools_eolp_other_custom_fields');
