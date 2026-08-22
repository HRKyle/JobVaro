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
  grace_ends_at       TIMESTAMPTZ,             -- end of the 30-day post-lapse grace period (NULL = no grace active)
  grace_notice_level  INT DEFAULT 0,           -- 0=none, 1=lapse-day email sent, 2=final-warning email sent
  is_admin            BOOLEAN      DEFAULT FALSE,
  created_at          TIMESTAMPTZ  DEFAULT now()
);

-- Fixed-term paid plan columns (no auto-renewal - paid plans revert to free on plan_expires_at)
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS expiry_notice_level INT DEFAULT 0;

-- Data-lapse policy (Option A): 30-day grace after a paid plan lapses, then
-- over-limit data is permanently deleted. grace_notice_level dedups emails.
ALTER TABLE users ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS grace_notice_level INT DEFAULT 0;
-- Email verification (cuts fake accounts): new signups must click a link sent
-- to their real inbox before they can log in. Existing accounts (created before
-- this migration) are backfilled as verified so they keep access unchanged —
-- only NEW signups are gated. Admins are always treated as verified.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE users SET email_verified = TRUE;

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
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- created_at is used by the data-lapse policy to determine the "5 most
-- recently created" applications (locked vs kept during grace).
ALTER TABLE applications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
UPDATE applications SET created_at = COALESCE(created_at, applied_at, updated_at, now()) WHERE created_at IS NULL;

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

-- Geocoding columns (radius search): lat/lng for each job's location text,
-- populated best-effort during feed refresh / on save. NULL = not geocodable
-- (e.g. Remote, ambiguous, or unresolved) → excluded from radius filtering.
ALTER TABLE saved_jobs     ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE saved_jobs     ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE jobs_feed      ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE jobs_feed      ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE community_jobs ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE community_jobs ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS idx_saved_jobs_geo     ON saved_jobs(lat, lng);
CREATE INDEX IF NOT EXISTS idx_jobs_feed_geo      ON jobs_feed(lat, lng);
CREATE INDEX IF NOT EXISTS idx_community_jobs_geo ON community_jobs(lat, lng);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id     ON saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id   ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status    ON applications(status);
CREATE INDEX IF NOT EXISTS idx_app_events_app_id      ON application_events(application_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token          ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id        ON sessions(user_id);

-- Password reset tokens: single-use, 60-minute expiry for the self-serve
-- "Forgot your password?" flow. The token is stored hashed (SHA-256) at rest —
-- the raw token is only ever sent to the user in their reset email and never
-- logged or stored in plaintext. used_at marks a token consumed (single-use).
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA-256 of the raw reset token
  email      VARCHAR(255) NOT NULL,        -- account the reset was requested for
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,                  -- NULL until the token is consumed
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user    ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens(expires_at);
-- Email verification tokens: single-use, 24-hour expiry for the "confirm your
-- email" step after signup. Stored hashed (SHA-256) at rest, same pattern as
-- password reset tokens — the raw token only ever lives in the user's inbox.
CREATE TABLE IF NOT EXISTS verification_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA-256 of the raw verify token
  email      VARCHAR(255) NOT NULL,        -- the address that must be confirmed
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,                  -- NULL until the token is consumed
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user    ON verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON verification_tokens(expires_at);
