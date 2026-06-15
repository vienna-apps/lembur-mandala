-- ═══════════════════════════════════════════════════════
--  Lembur Mandala — Supabase Schema
--  Run in Supabase SQL editor (top to bottom)
-- ═══════════════════════════════════════════════════════

-- ── Profiles ─────────────────────────────────────────
-- One row per Supabase Auth user.
-- Create users in Supabase Auth console first, then
-- insert their profile row here with matching id.
CREATE TABLE IF NOT EXISTS profiles (
  id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nik      TEXT NOT NULL UNIQUE,
  nama     TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  username TEXT NOT NULL UNIQUE,    -- first name lowercase, used for login lookup
  gmail    TEXT UNIQUE,             -- optional @daksa.co.id for password reset
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Service full access on profiles" ON profiles FOR ALL USING (auth.role() = 'service_role');

-- Seed profiles after creating users in Supabase Auth console.
-- Example (replace UUIDs with actual auth.users.id values):
-- INSERT INTO profiles (id, nik, nama, is_admin) VALUES
--   ('<vania-uuid>',   '170068', 'Vania Sanjaya',              true),
--   ('<aditya-uuid>',  '230011', 'Aditya Ari Pratama',         false),
--   ('<cendana-uuid>', '220079', 'Cendana Idli Mulia A',       false),
--   ('<cepi-uuid>',    '230029', 'Cepi Rohman Herdiansyah',    false),
--   ('<dwij-uuid>',    '230078', 'Dwijayanto Taufik',          false),
--   ('<iman-uuid>',    '210013', 'Iman Taufik Purnama',        false),
--   ('<luqman-uuid>',  '210070', 'Luqmanul Hakim Aziz',        false),
--   ('<harits-uuid>',  '230127', 'Muhamad Harits Subagja',     false),
--   ('<pega-uuid>',    '200097', 'Pega Kurnia',                false),
--   ('<rizaldi-uuid>', '200030', 'Rizaldi Andriyana',          false),
--   ('<setiawan-uuid>','220061', 'Setiawan Gunadi',            false),
--   ('<windra-uuid>',  '240044', 'Windra Halim',               false),
--   ('<zamzam-uuid>',  '190082', 'Zamzam Jamaludin Abdullah',  false),
--   ('<zulvan-uuid>',  '260018', 'Zulvan Fadhillah',          false);

-- ── Deadlines ─────────────────────────────────────────
-- One row per bulan (e.g. "2026-06"), set by admin.
CREATE TABLE IF NOT EXISTS deadlines (
  bulan         TEXT PRIMARY KEY,    -- "YYYY-MM"
  deadline_date DATE,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE deadlines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone read deadlines" ON deadlines FOR SELECT USING (true);
CREATE POLICY "Service manage deadlines" ON deadlines FOR ALL USING (auth.role() = 'service_role');

-- ── Lembur Months ─────────────────────────────────────
-- One row per (user, bulan). Created when employee first
-- adds an event for that month.
CREATE TABLE IF NOT EXISTS lembur_months (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bulan        TEXT NOT NULL,           -- "YYYY-MM"
  status       TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'submitted'
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, bulan)
);

ALTER TABLE lembur_months ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own months" ON lembur_months FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own months" ON lembur_months FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own months" ON lembur_months FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service full months" ON lembur_months FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_lm_user ON lembur_months(user_id);
CREATE INDEX idx_lm_bulan ON lembur_months(bulan);

-- ── Lembur Events ─────────────────────────────────────
-- Individual overtime events within a month submission.
CREATE TABLE IF NOT EXISTS lembur_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id     UUID NOT NULL REFERENCES lembur_months(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hari_tanggal DATE NOT NULL,
  project      TEXT NOT NULL,
  kegiatan     TEXT[] NOT NULL DEFAULT '{}',  -- array of descriptions
  dari_jam     TEXT NOT NULL,
  sampai_jam   TEXT NOT NULL,
  durasi       NUMERIC(6,2) NOT NULL,          -- manually editable
  standby      BOOLEAN NOT NULL DEFAULT false,
  akhir_pekan  BOOLEAN NOT NULL DEFAULT false,
  wfo          BOOLEAN NOT NULL DEFAULT false,
  total_jam    NUMERIC(6,2) NOT NULL,          -- kompensasi result
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE lembur_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own events" ON lembur_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own events" ON lembur_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own events" ON lembur_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own events" ON lembur_events FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service full events" ON lembur_events FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_le_month ON lembur_events(month_id);
CREATE INDEX idx_le_user ON lembur_events(user_id);
CREATE INDEX idx_le_date ON lembur_events(hari_tanggal);

-- ── Kegiatan Suggestions ──────────────────────────────
CREATE TABLE IF NOT EXISTS kegiatan_suggestions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text       TEXT UNIQUE NOT NULL,
  use_count  INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE kegiatan_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all on suggestions" ON kegiatan_suggestions
  FOR ALL USING (true) WITH CHECK (true);

INSERT INTO kegiatan_suggestions (text, use_count) VALUES
  ('Standby Zoom', 0),
  ('Standby Discord', 0),
  ('Execute Queries', 0),
  ('Execute Deployment', 0),
  ('Make Query', 0),
  ('Check Log', 0),
  ('Konfirmasi semua berjalan sesuai timeline', 0)
ON CONFLICT (text) DO NOTHING;
