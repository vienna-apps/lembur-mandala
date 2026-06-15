'use client'
import { getSupabaseClient } from './supabase-client'
import type { LemburEvent, LemburMonth, Deadline } from './types'

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await getSupabaseClient().auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch(url: string, opts: RequestInit = {}) {
  const headers = await authHeader()
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...headers, ...(opts.headers ?? {}) } })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? res.statusText) }
  return res.json()
}

// ── Months ────────────────────────────────────────────
export async function getMyMonths(): Promise<LemburMonth[]> {
  return apiFetch('/api/months')
}

export async function getMonthDetail(bulan: string): Promise<{ month: LemburMonth | null; events: LemburEvent[] }> {
  return apiFetch(`/api/months/${bulan}`)
}

export async function ensureMonth(bulan: string): Promise<LemburMonth> {
  return apiFetch('/api/months', { method: 'POST', body: JSON.stringify({ bulan }) })
}

export async function submitMonth(bulan: string): Promise<LemburMonth> {
  return apiFetch(`/api/months/${bulan}`, { method: 'PATCH', body: JSON.stringify({ status: 'submitted' }) })
}

export async function unsubmitMonth(bulan: string): Promise<LemburMonth> {
  return apiFetch(`/api/months/${bulan}`, { method: 'PATCH', body: JSON.stringify({ status: 'draft' }) })
}

// ── Events ────────────────────────────────────────────
export async function createEvent(payload: Omit<LemburEvent, 'id'|'month_id'|'user_id'|'created_at'> & { bulan: string }): Promise<LemburEvent> {
  return apiFetch('/api/events', { method: 'POST', body: JSON.stringify(payload) })
}

export async function updateEvent(id: string, payload: Partial<LemburEvent>): Promise<LemburEvent> {
  return apiFetch(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export async function deleteEvent(id: string): Promise<void> {
  await apiFetch(`/api/events/${id}`, { method: 'DELETE' })
}

// ── Deadlines ─────────────────────────────────────────
export async function getDeadlines(): Promise<Deadline[]> {
  return apiFetch('/api/deadlines')
}

export async function setDeadline(bulan: string, deadline_date: string | null): Promise<Deadline> {
  return apiFetch('/api/deadlines', { method: 'PUT', body: JSON.stringify({ bulan, deadline_date }) })
}

// ── Admin ─────────────────────────────────────────────
export async function getAdminMonth(bulan: string) {
  return apiFetch(`/api/admin/months/${bulan}`)
}

// ── Suggestions ───────────────────────────────────────
export async function getSuggestions(q?: string): Promise<string[]> {
  const url = q ? `/api/suggestions?q=${encodeURIComponent(q)}` : '/api/suggestions'
  const data: { text: string }[] = await apiFetch(url)
  return data.map(d => d.text)
}

export async function saveSuggestion(text: string): Promise<void> {
  await apiFetch('/api/suggestions', { method: 'POST', body: JSON.stringify({ text }) })
}

// ── Profile ───────────────────────────────────────────
export async function updateGmail(gmail: string | null): Promise<void> {
  await apiFetch('/api/profile', { method: 'PATCH', body: JSON.stringify({ gmail }) })
}

// ── Upload xlsx ───────────────────────────────────────
export async function uploadXlsx(file: File, bulan: string, commit: boolean) {
  const { data } = await getSupabaseClient().auth.getSession()
  const token = data.session?.access_token
  const fd = new FormData()
  fd.append('file', file)
  fd.append('bulan', bulan)
  fd.append('commit', String(commit))
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? res.statusText) }
  return res.json()
}
