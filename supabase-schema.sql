-- Run this in your Supabase SQL editor to create the table

CREATE TABLE IF NOT EXISTS lembur_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama            TEXT NOT NULL,
  nik             TEXT NOT NULL DEFAULT '',
  hari_tanggal    DATE NOT NULL,
  project         TEXT NOT NULL,
  kegiatan        TEXT NOT NULL,
  dari_jam        TEXT NOT NULL,
  sampai_jam      TEXT NOT NULL,
  durasi          NUMERIC(6,2) NOT NULL DEFAULT 0,
  standby         BOOLEAN NOT NULL DEFAULT false,
  akhir_pekan     BOOLEAN NOT NULL DEFAULT false,
  wfo             BOOLEAN NOT NULL DEFAULT false,
  total_jam       NUMERIC(6,2) NOT NULL DEFAULT 0,
  catatan         TEXT DEFAULT '',
  folder_label    TEXT DEFAULT '',
  submitted_at    TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (allow public read/insert, restrict delete)
ALTER TABLE lembur_entries ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read and insert (members fill the form without auth)
CREATE POLICY "Allow public read" ON lembur_entries
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON lembur_entries
  FOR INSERT WITH CHECK (true);

-- Only service role (admin) can update/delete
CREATE POLICY "Allow service delete" ON lembur_entries
  FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY "Allow service update" ON lembur_entries
  FOR UPDATE USING (auth.role() = 'service_role');

-- Index for common queries
CREATE INDEX idx_lembur_folder ON lembur_entries(folder_label);
CREATE INDEX idx_lembur_nama ON lembur_entries(nama);
CREATE INDEX idx_lembur_date ON lembur_entries(hari_tanggal);

-- ── Kegiatan Suggestions ─────────────────────────────────────────────────────
-- Run this block separately if lembur_entries already exists

CREATE TABLE IF NOT EXISTS kegiatan_suggestions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text       TEXT UNIQUE NOT NULL,
  use_count  INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE kegiatan_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all on suggestions" ON kegiatan_suggestions
  FOR ALL USING (true) WITH CHECK (true);

-- Seed default suggestions
INSERT INTO kegiatan_suggestions (text, use_count) VALUES
  ('Standby Zoom', 0),
  ('Standby Discord', 0),
  ('Execute Queries', 0),
  ('Execute Deployment', 0),
  ('Make Query', 0),
  ('Check Log', 0),
  ('Konfirmasi semua berjalan sesuai timeline', 0)
ON CONFLICT (text) DO NOTHING;
