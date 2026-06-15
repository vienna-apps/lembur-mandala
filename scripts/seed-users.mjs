/**
 * seed-users.mjs — Create all Supabase Auth users + profiles for Lembur Mandala
 *
 * Usage:
 *   node scripts/seed-users.mjs
 *
 * Requires env vars (copy from your .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Login: username = firstname (e.g. "vania"), password = firstname+NIK (e.g. "vania170068")
 * Supabase requires email format internally — stored as <first>@lembur, never shown to users.
 */

import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dir, '..', '.env.local')
try {
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
} catch { /* .env.local might not exist — fall through to process.env */ }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('Set them in .env.local or as environment variables.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Team roster ──────────────────────────────────────────────────────────────
// password = firstname + NIK (all lowercase)
// email    = firstname + NIK @lembur
const TEAM = [
  { nama: 'Vania Sanjaya',              nik: '170068', first: 'vania',      is_admin: true  },
  { nama: 'Aditya Ari Pratama',         nik: '230011', first: 'aditya',     is_admin: false },
  { nama: 'Cendana Idli Mulia A',       nik: '220079', first: 'cendana',    is_admin: false },
  { nama: 'Cepi Rohman Herdiansyah',    nik: '230029', first: 'cepi',       is_admin: false },
  { nama: 'Dwijayanto Taufik',          nik: '230078', first: 'dwijayanto', is_admin: false },
  { nama: 'Iman Taufik Purnama',        nik: '210013', first: 'iman',       is_admin: false },
  { nama: 'Luqmanul Hakim Aziz',        nik: '210070', first: 'luqmanul',   is_admin: false },
  { nama: 'Muhamad Harits Subagja',     nik: '230127', first: 'muhamad',    is_admin: false },
  { nama: 'Pega Kurnia',                nik: '200097', first: 'pega',       is_admin: false },
  { nama: 'Rizaldi Andriyana',          nik: '200030', first: 'rizaldi',    is_admin: false },
  { nama: 'Setiawan Gunadi',            nik: '220061', first: 'setiawan',   is_admin: false },
  { nama: 'Windra Halim',               nik: '240044', first: 'windra',     is_admin: false },
  { nama: 'Zamzam Jamaludin Abdullah',  nik: '190082', first: 'zamzam',     is_admin: false },
  { nama: 'Zulvan Fadhillah',           nik: '260018', first: 'zulvan',     is_admin: false },
]

// ── Main ─────────────────────────────────────────────────────────────────────
console.log(`\nSeeding ${TEAM.length} users into ${SUPABASE_URL}\n`)

let created = 0, skipped = 0, failed = 0

for (const person of TEAM) {
  const email    = `${person.first}@lembur`
  const password = `${person.first}${person.nik}`

  // 1. Create auth user
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,   // skip email verification — internal tool
    user_metadata: { nama: person.nama, nik: person.nik },
  })

  if (error) {
    if (error.message?.includes('already been registered') || error.message?.includes('already exists')) {
      console.log(`  SKIP  ${person.nama} — already exists`)
      skipped++
      continue
    }
    console.error(`  FAIL  ${person.nama}: ${error.message}`)
    failed++
    continue
  }

  const userId = data.user.id

  // 2. Insert profile row
  const { error: profileErr } = await supabase.from('profiles').upsert({
    id:       userId,
    nik:      person.nik,
    nama:     person.nama,
    is_admin: person.is_admin,
    username: person.first,
  }, { onConflict: 'id' })

  if (profileErr) {
    console.error(`  FAIL  profile for ${person.nama}: ${profileErr.message}`)
    failed++
    continue
  }

  console.log(`  OK    ${person.nama}`)
  console.log(`        username: ${person.first}`)
  console.log(`        password: ${password}`)
  console.log(`        uuid:     ${userId}`)
  created++
}

console.log(`\n──────────────────────────────────────────`)
console.log(`Created: ${created}  Skipped: ${skipped}  Failed: ${failed}`)
console.log(`──────────────────────────────────────────\n`)

if (failed > 0) process.exit(1)
