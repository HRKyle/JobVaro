-- JobHub database schema
-- Run via: bun run src/db/migrate.ts

-- Users table: core user accounts
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               VARCHAR(255) UNIQUE NOT NULL,
  password_hash       VARCHAR(255) NOT NULL,
  name                VARCHAR(255),
  plan                VARCHAR(50)  DEFAULT 'free',
  plan_expires_at     TIMESTAMPTZ,             -- fixed expiry of a one-time paid plan (NULL = never expires)
  expiry_notice_level INT DEFAULT 0,           -- highest expiry-notice threshold already delivered (7/5/3/1)
  is_admin            BOOLEAN      DEFAULT FALSE,
  created_at          TIMESTAMPTZ  DEFAULT now()
);

-- Fixed-term paid plan columns (no auto-renewal - paid plans revert to free on plan_expires_at)
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS expiry_notice_level INT DEFAULT 0;

-- Saved / bookmarked jobs (from external sources or manual entry)
CREATE TABLE IF NOT EXISTS saved_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id VARCHAR(255),
  title       VARCHAR(255) NOT NULL,
  company     VARCHAR(255) NOT NULL,
  location    VARCHAR(255),
  description TEXT,
  url         TEXT,
  source      VARCHAR(100),
  salary      VARCHAR(100),
  posted_at   TIMESTAMPTZ,
  saved_at    TIMESTAMPTZ DEFAULT now()
);

-- Job applications tracked by users
CREATE TABLE IF NOT EXISTS applications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id      UUID        REFERENCES saved_jobs(id) ON DELETE SET NULL,
  job_title   VARCHAR(255) NOT NULL,
  company     VARCHAR(255) NOT NULL,
  status      VARCHAR(50)  DEFAULT 'applied',
  applied_at  TIMESTAMPTZ DEFAULT now(),
  notes       TEXT,
  follow_up_at TIMESTAMPTZ,
  job_url     TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Timeline events for each application (status changes, interviews, etc.)
CREATE TABLE IF NOT EXISTS application_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID        NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event_type     VARCHAR(50),
  event_date     TIMESTAMPTZ DEFAULT now(),
  notes          TEXT
);

-- Sessions table: cookie-based session management
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(255) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ  DEFAULT now(),
  expires_at  TIMESTAMPTZ  NOT NULL
);

-- Add job_url column to applications if it doesn't exist (migration from earlier schema)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS job_url TEXT;

-- Community job board: jobs shared by users
CREATE TABLE IF NOT EXISTS community_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  description TEXT,
  url TEXT,
  salary VARCHAR(100),
  source VARCHAR(100),
  posted_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_jobs_posted ON community_jobs(posted_at DESC);

-- Company watchlist: companies followed by users
CREATE TABLE IF NOT EXISTS company_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_slug VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, company_slug)
);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON company_watchlist(user_id);

-- ATS-fetched jobs feed
CREATE TABLE IF NOT EXISTS jobs_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) UNIQUE,
  title VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  company_slug VARCHAR(255),
  location VARCHAR(255),
  description TEXT,
  url TEXT,
  salary VARCHAR(100),
  source VARCHAR(100),
  posted_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_feed_company ON jobs_feed(company_slug);
CREATE INDEX IF NOT EXISTS idx_jobs_feed_posted ON jobs_feed(posted_at DESC);

-- AI-powered resume/job match analyses
CREATE TABLE IF NOT EXISTS compass_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  job_title TEXT NOT NULL,
  company TEXT,
  job_description TEXT NOT NULL,
  resume_text TEXT NOT NULL,
  match_score INTEGER,
  report_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compass_analyses_user ON compass_analyses(user_id, created_at DESC);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id     ON saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id   ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status    ON applications(status);
CREATE INDEX IF NOT EXISTS idx_app_events_app_id      ON application_events(application_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token          ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id        ON sessions(user_id);
