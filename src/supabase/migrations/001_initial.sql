-- ═══════════════════════════════════════════════════════════════════════════
--  TaxFlow AI — Initial Schema Migration (idempotent, safe to re-run)
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── users_profile ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users_profile (
  id                        uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                     text        NOT NULL,
  full_name                 text,
  business_name             text,
  business_number           text,                               -- 사업자등록번호
  business_type             text        NOT NULL DEFAULT 'creator',
  business_type_code        text,                               -- 국세청 업종코드
  is_simplified_tax         boolean     DEFAULT false,          -- 간이과세자 여부
  annual_revenue_tier       text        DEFAULT 'under_50m',    -- under_50m | 50m_150m | over_150m
  plan                      text        NOT NULL DEFAULT 'free'
                              CHECK (plan IN ('free', 'pro', 'business')),
  stripe_customer_id        text,
  stripe_subscription_id    text,
  monthly_classify_count    integer     DEFAULT 0,
  monthly_classify_reset_at timestamptz DEFAULT now(),
  onboarding_completed      boolean     DEFAULT false,
  referral_code             text        UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  referred_by               text,
  free_months_remaining     integer     DEFAULT 0,
  kakao_token               text,
  notification_email        boolean     DEFAULT true,
  notification_kakao        boolean     DEFAULT false,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

-- ── csv_batches ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS csv_batches (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid        NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  filename       text        NOT NULL,
  bank_name      text        NOT NULL,
  storage_path   text,
  total_rows     integer     DEFAULT 0,
  processed_rows integer     DEFAULT 0,
  status         text        DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'done', 'error')),
  period_start   date,
  period_end     date,
  error_message  text,
  created_at     timestamptz DEFAULT now()
);

-- ── transactions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          uuid        NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  batch_id         uuid        REFERENCES csv_batches(id) ON DELETE CASCADE,
  tx_hash          text        NOT NULL,
  transaction_date date        NOT NULL,
  description      text        NOT NULL,
  amount           numeric(15, 2) NOT NULL,
  bank_name        text,
  account_last4    text,
  tax_category     text,
  category_label   text,
  vat_deductible   boolean,
  expense_type     text,
  confidence       numeric(4, 3),
  ai_reason        text,
  risk_flag        text[],
  receipt_required boolean     DEFAULT false,
  manually_reviewed boolean    DEFAULT false,
  user_category    text,
  user_note        text,
  created_at       timestamptz DEFAULT now()
);

-- ── tax_reports ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_reports (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          uuid        NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  report_type      text        NOT NULL
                     CHECK (report_type IN ('vat_q1', 'vat_q2', 'vat_q3', 'vat_q4', 'income_tax', 'monthly')),
  period_year      integer     NOT NULL,
  period_quarter   integer,
  total_income     numeric(15, 2) DEFAULT 0,
  total_expense    numeric(15, 2) DEFAULT 0,
  vat_payable      numeric(15, 2) DEFAULT 0,
  estimated_tax    numeric(15, 2) DEFAULT 0,
  risk_score       integer     DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  deductions       jsonb       DEFAULT '{}',
  optimization_tips jsonb      DEFAULT '[]',
  file_url         text,
  disclaimer_shown boolean     DEFAULT true,
  generated_at     timestamptz DEFAULT now()
);

-- ── optimization_alerts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS optimization_alerts (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid        NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  alert_type    text        NOT NULL
                  CHECK (alert_type IN (
                    'receipt_missing', 'deduction_found', 'tax_deadline',
                    'law_change', 'saving_opportunity'
                  )),
  title         text        NOT NULL,
  body          text        NOT NULL,
  amount_impact numeric(15, 2),
  is_read       boolean     DEFAULT false,
  is_pushed     boolean     DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- ── tax_law_table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_law_table (
  id             serial      PRIMARY KEY,
  category       text        NOT NULL,
  key            text        NOT NULL UNIQUE,
  value          jsonb       NOT NULL,
  description    text,
  effective_year integer     DEFAULT 2026,
  updated_at     timestamptz DEFAULT now()
);

-- ── Seed: 2026 Korean tax law data (upsert — safe to re-run) ─────────────────
INSERT INTO tax_law_table (category, key, value, description) VALUES
(
  'income_tax_brackets', 'brackets_2026',
  '[
    {"min":0,         "max":14000000,  "rate":0.06, "deduction":0},
    {"min":14000000,  "max":50000000,  "rate":0.15, "deduction":1260000},
    {"min":50000000,  "max":88000000,  "rate":0.24, "deduction":5760000},
    {"min":88000000,  "max":150000000, "rate":0.35, "deduction":15440000},
    {"min":150000000, "max":300000000, "rate":0.38, "deduction":19940000},
    {"min":300000000, "max":500000000, "rate":0.40, "deduction":25940000},
    {"min":500000000, "max":null,      "rate":0.42, "deduction":35940000}
  ]',
  '2026년 종합소득세율표'
),
(
  'vat', 'standard_rate',
  '{"rate": 0.10}',
  '부가가치세 표준세율 10%'
),
(
  'vat', 'simplified_rate',
  '{"rate": 0.04}',
  '간이과세자 부가세율 4%'
),
(
  'deduction_limits', 'entertainment',
  '{"annual_limit": 3600000, "per_receipt_limit": 30000}',
  '접대비 한도'
),
(
  'deduction_limits', 'vehicle',
  '{"business_use_ratio": 0.5}',
  '업무용 승용차 50% 한도'
),
(
  'deduction_limits', 'yellow_umbrella',
  '{"max_deduction": 5000000, "income_threshold": 40000000}',
  '노란우산공제'
),
(
  'creator_deductions', 'equipment',
  '{"items": ["카메라","렌즈","조명","마이크","삼각대","짐벌","드론","모니터","태블릿"], "note": "업무 목적 입증 필요"}',
  '크리에이터 장비 공제'
),
(
  'creator_deductions', 'software',
  '{"items": ["Adobe Creative Cloud","Final Cut Pro","DaVinci Resolve","CapCut Pro","Canva Pro","Notion"], "note": "구독형 소프트웨어 전액 공제 가능"}',
  '편집 소프트웨어 공제'
),
(
  'creator_deductions', 'studio',
  '{"items": ["스튜디오 임차료","배경지","소품","인테리어"], "note": "사업 목적 사용 입증 시 전액 공제"}',
  '스튜디오 관련 공제'
),
(
  'creator_deductions', 'advertising',
  '{"items": ["유튜브 광고비","인스타그램 광고비","네이버 광고","카카오 광고"], "note": "사업 목적 광고비 전액 공제"}',
  '온라인 광고비 공제'
)
ON CONFLICT (key) DO UPDATE SET
  value       = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at  = now();

-- ── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE users_profile       ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_batches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_law_table       ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent)
DROP POLICY IF EXISTS "users own profile"       ON users_profile;
DROP POLICY IF EXISTS "users own batches"       ON csv_batches;
DROP POLICY IF EXISTS "users own transactions"  ON transactions;
DROP POLICY IF EXISTS "users own reports"       ON tax_reports;
DROP POLICY IF EXISTS "users own alerts"        ON optimization_alerts;
DROP POLICY IF EXISTS "tax law public read"     ON tax_law_table;

CREATE POLICY "users own profile"
  ON users_profile FOR ALL USING (auth.uid() = id);

CREATE POLICY "users own batches"
  ON csv_batches FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users own transactions"
  ON transactions FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users own reports"
  ON tax_reports FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users own alerts"
  ON optimization_alerts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "tax law public read"
  ON tax_law_table FOR SELECT USING (true);

-- ── Indexes (IF NOT EXISTS) ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tx_user_date  ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_batch      ON transactions(batch_id);
CREATE INDEX IF NOT EXISTS idx_tx_hash       ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_tx_category   ON transactions(user_id, tax_category);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON optimization_alerts(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_batches_user  ON csv_batches(user_id, created_at DESC);

-- ── Auto-update updated_at trigger ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users_profile;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Auto-create profile on signup ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users_profile (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
