/**
 * Trading journal — local-first storage via AsyncStorage.
 * No account, no network. Entries live on the device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface JournalEntry {
  id: string;
  createdAt: string; // ISO timestamp
  symbol: string;
  direction: 'long' | 'short';
  entry: number;
  stop: number;
  target?: number;
  contracts: number;
  /** realized result as a multiple of risk, e.g. 2 = +2R, -1 = stopped out */
  resultR?: number;
  notes: string;
  /** summary line produced by the ICT analysis flow, if any */
  timeframeBias?: string;
  /** full AI report JSON (stringified IctReport), if any */
  aiReport?: string;
}

const STORAGE_KEY = 'tradeos.journal.v1';

export async function loadEntries(): Promise<JournalEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JournalEntry[]) : [];
  } catch {
    return [];
  }
}

export async function saveEntries(entries: JournalEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function newEntry(
  partial: Partial<JournalEntry> & { symbol: string },
): JournalEntry {
  const entry: JournalEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    symbol: partial.symbol.trim().toUpperCase() || 'ES',
    direction: partial.direction ?? 'long',
    entry: partial.entry ?? 0,
    stop: partial.stop ?? 0,
    contracts: partial.contracts ?? 0,
    notes: partial.notes ?? '',
  };
  if (partial.target !== undefined) entry.target = partial.target;
  if (partial.resultR !== undefined) entry.resultR = partial.resultR;
  if (partial.timeframeBias) entry.timeframeBias = partial.timeframeBias;
  if (partial.aiReport) entry.aiReport = partial.aiReport;
  return entry;
}

export interface JournalSummary {
  total: number;
  closed: number;
  totalR: number;
  winRate: number; // 0-100
}

export function summarize(entries: JournalEntry[]): JournalSummary {
  const closed = entries.filter((e) => typeof e.resultR === 'number');
  const totalR = closed.reduce((s, e) => s + (e.resultR ?? 0), 0);
  const wins = closed.filter((e) => (e.resultR ?? 0) > 0).length;
  return {
    total: entries.length,
    closed: closed.length,
    totalR: Math.round(totalR * 100) / 100,
    winRate: closed.length ? Math.round((wins / closed.length) * 100) : 0,
  };
}
