-- 001_initial_schema.sql
-- PostgreSQL baseline for the travel review MVP.
-- Apply only after a managed PostgreSQL instance and migration runner are selected.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE account_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE place_kind AS ENUM ('fixed_shop', 'mobile_stall');
CREATE TYPE place_status AS ENUM ('candidate', 'active', 'temporarily_closed', 'closed', 'merged');
CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'rejected', 'appealed');
CREATE TYPE media_redaction_status AS ENUM ('not_required', 'pending', 'redacted', 'failed');
CREATE TYPE contribution_status AS ENUM ('draft', 'submitted', 'under_review', 'published', 'hidden', 'rejected');
CREATE TYPE evidence_kind AS ENUM ('on_site_photo', 'purchase_proof', 'menu_or_price', 'user_statement');
CREATE TYPE evidence_status AS ENUM ('unverified', 'verified', 'rejected');
CREATE TYPE coordinate_crs AS ENUM ('WGS84', 'GCJ02', 'BD09');
CREATE TYPE price_kind AS ENUM ('menu_price', 'paid_price');
CREATE TYPE ledger_status AS ENUM ('pending', 'posted', 'reversed', 'voided');

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(60) NOT NULL,
  status account_status NOT NULL DEFAULT 'active',
  reputation_score integer NOT NULL DEFAULT 0 CHECK (reputation_score >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind place_kind NOT NULL,
  name varchar(160) NOT NULL,
  normalized_name varchar(180) NOT NULL,
  category varchar(60) NOT NULL,
  status place_status NOT NULL DEFAULT 'candidate',
  merged_into_place_id uuid REFERENCES places(id),
  created_by_user_id uuid REFERENCES app_users(id),
  moderation_status moderation_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (merged_into_place_id IS NULL OR merged_into_place_id <> id)
);

CREATE INDEX places_name_search_idx ON places (normalized_name);
CREATE INDEX places_status_category_idx ON places (status, category);

CREATE TABLE place_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES places(id),
  longitude numeric(10,7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  latitude numeric(10,7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  crs coordinate_crs NOT NULL,
  address_text varchar(300),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  source varchar(40) NOT NULL,
  moderation_status moderation_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE INDEX place_locations_place_time_idx ON place_locations (place_id, valid_from DESC);

CREATE TABLE contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id),
  place_id uuid NOT NULL REFERENCES places(id),
  experienced_at timestamptz NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  taste_score smallint CHECK (taste_score BETWEEN 1 AND 5),
  value_score smallint CHECK (value_score BETWEEN 1 AND 5),
  portion_score smallint CHECK (portion_score BETWEEN 1 AND 5),
  service_score smallint CHECK (service_score BETWEEN 1 AND 5),
  hygiene_score smallint CHECK (hygiene_score BETWEEN 1 AND 5),
  worth_a_trip boolean,
  would_return boolean,
  body varchar(2000),
  status contribution_status NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contributions_place_time_idx ON contributions (place_id, experienced_at DESC);
CREATE INDEX contributions_user_time_idx ON contributions (user_id, experienced_at DESC);
CREATE INDEX contributions_status_time_idx ON contributions (status, submitted_at DESC);

CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  object_key varchar(500) NOT NULL UNIQUE,
  media_type varchar(80) NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  captured_at timestamptz,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  content_sha256 char(64),
  redaction_status media_redaction_status NOT NULL DEFAULT 'pending',
  moderation_status moderation_status NOT NULL DEFAULT 'pending'
);

CREATE INDEX media_assets_contribution_idx ON media_assets (contribution_id);

CREATE TABLE evidence_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  media_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  kind evidence_kind NOT NULL,
  status evidence_status NOT NULL DEFAULT 'unverified',
  reviewer_note varchar(1000),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX evidence_contribution_idx ON evidence_records (contribution_id, kind);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES places(id),
  name varchar(160) NOT NULL,
  specification varchar(160) NOT NULL,
  unit varchar(40) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (place_id, name, specification, unit)
);

CREATE TABLE price_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  contribution_id uuid REFERENCES contributions(id),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency char(3) NOT NULL,
  price_kind price_kind NOT NULL,
  observed_at timestamptz NOT NULL,
  evidence_record_id uuid REFERENCES evidence_records(id),
  moderation_status moderation_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX price_observations_product_time_idx ON price_observations (product_id, observed_at DESC);

CREATE TABLE reward_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id),
  amount_points integer NOT NULL CHECK (amount_points <> 0),
  status ledger_status NOT NULL DEFAULT 'pending',
  reason_code varchar(60) NOT NULL,
  contribution_id uuid REFERENCES contributions(id),
  idempotency_key varchar(160) NOT NULL UNIQUE,
  reverses_ledger_id uuid REFERENCES reward_ledger(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz
);

CREATE INDEX reward_ledger_user_time_idx ON reward_ledger (user_id, created_at DESC);
CREATE INDEX reward_ledger_status_time_idx ON reward_ledger (status, created_at);


-- Request-level idempotency: prevents duplicate experience writes on retries.
CREATE TABLE api_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id),
  idempotency_key varchar(160) NOT NULL,
  request_hash char(64) NOT NULL,
  contribution_id uuid REFERENCES contributions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);


-- Request-level idempotency: prevents duplicate experience writes on retries.
CREATE TABLE api_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id),
  idempotency_key varchar(160) NOT NULL,
  request_hash char(64) NOT NULL,
  contribution_id uuid REFERENCES contributions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
