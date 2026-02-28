-- TCCTDB Supabase Schema
-- Run this in the Supabase SQL Editor to set up the database

-- ============================================
-- TABLES
-- ============================================

-- Companies (theater groups)
CREATE TABLE companies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  logo_url text,
  location text,
  website text,
  created_at timestamptz DEFAULT now()
);

-- People (actors, crew, directors)
CREATE TABLE people (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name_first text NOT NULL,
  name_last text NOT NULL DEFAULT '',
  bio text,
  image_url text,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Productions (shows)
CREATE TABLE productions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id),
  opening_date date,
  closing_date date,
  image_url text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Roles (the central join — cast and crew assignments)
CREATE TABLE roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  production_id uuid NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  role_type text NOT NULL CHECK (role_type IN ('cast', 'crew')),
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Proposed edits (moderation queue)
CREATE TABLE proposed_edits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  target_table text NOT NULL,
  target_id uuid NOT NULL,
  proposed_data jsonb NOT NULL,
  submitted_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewer_notes text,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_productions_company ON productions(company_id);
CREATE INDEX idx_productions_date ON productions(opening_date DESC);
CREATE INDEX idx_roles_production ON roles(production_id);
CREATE INDEX idx_roles_person ON roles(person_id);
CREATE INDEX idx_roles_type ON roles(role_type);
CREATE INDEX idx_people_user ON people(user_id);
CREATE INDEX idx_proposed_edits_status ON proposed_edits(status);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposed_edits ENABLE ROW LEVEL SECURITY;

-- Public read access for all content tables
CREATE POLICY "Public read access" ON companies FOR SELECT USING (true);
CREATE POLICY "Public read access" ON people FOR SELECT USING (true);
CREATE POLICY "Public read access" ON productions FOR SELECT USING (true);
CREATE POLICY "Public read access" ON roles FOR SELECT USING (true);

-- Users can read their own proposed edits
CREATE POLICY "Users read own edits" ON proposed_edits
  FOR SELECT USING (auth.uid() = submitted_by);

-- Users can submit proposed edits
CREATE POLICY "Users submit edits" ON proposed_edits
  FOR INSERT WITH CHECK (auth.uid() = submitted_by);

-- Users can update their own profile (person record linked to their account)
CREATE POLICY "Users update own profile" ON people
  FOR UPDATE USING (auth.uid() = user_id);
