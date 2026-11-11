import * as fs from 'fs';
import * as path from 'path';

/**
 * Shared read/write helpers for `reports/testResults.json`.
 *
 * The file is a persistent history keyed by the row's Account number (falling
 * back to TC-No). It is consumed in two places:
 *   - The test spec, to skip rows whose last recorded status is `passed` or
 *     `duplicate` (resumable runs).
 *   - The PDF reporter, which upserts an entry per test in `onTestEnd` and
 *     renders the PDF from the file in `onEnd`.
 */

export type TestResultStatus =
  | 'passed'
  | 'failed'
  | 'timedOut'
  | 'skipped'
  | 'interrupted'
  | 'duplicate';

export interface TestResultEntry {
  key: string;              // account number if present, else TC-No
  testNo: string;           // TC-No from the Excel row
  sheetName: string;        // Excel sheet name (used as the PDF group)
  identifier: string;       // ID number or Business registration number
  accountNumber: string;    // Account number from the Excel row
  status: TestResultStatus; // last outcome
  isDuplicate: boolean;     // true when skipped because the client exists in the system
  durationSec: number;
  error: string;            // last error message (empty when none)
  screenshots: string[];    // relative paths inside the latest report folder
  lastRunAt: string;        // ISO timestamp of the most recent run that touched this entry
}

export interface TestResultsFile {
  entries: TestResultEntry[];
}

const RESULTS_FILE = path.resolve(process.cwd(), 'reports', 'testResults.json');

export function getResultsFilePath(): string {
  return RESULTS_FILE;
}

/** Builds the lookup key used in the JSON for an Excel row. */
export function makeKey(accountNumber: string, testNo: string): string {
  const acc = (accountNumber || '').trim();
  const tc = (testNo || '').trim();
  return acc || tc;
}

/** Loads the file; returns an empty structure if it does not yet exist or is corrupt. */
export function readResultsFile(): TestResultsFile {
  try {
    if (!fs.existsSync(RESULTS_FILE)) return { entries: [] };
    const raw = fs.readFileSync(RESULTS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<TestResultsFile>;
    if (!parsed || !Array.isArray(parsed.entries)) return { entries: [] };
    return { entries: parsed.entries as TestResultEntry[] };
  } catch {
    // Corrupt file: start fresh rather than crash the whole run.
    return { entries: [] };
  }
}

/** Looks up a single entry by key. Returns undefined when the key is unknown. */
export function findEntry(key: string): TestResultEntry | undefined {
  if (!key) return undefined;
  const data = readResultsFile();
  return data.entries.find((e) => e.key === key);
}

/** Inserts or updates an entry (by key) and persists the file. */
export function upsertEntry(entry: TestResultEntry): void {
  const data = readResultsFile();
  const idx = data.entries.findIndex((e) => e.key === entry.key);
  if (idx >= 0) {
    data.entries[idx] = entry;
  } else {
    data.entries.push(entry);
  }
  writeResultsFile(data);
}

/** Writes the file, creating the `reports/` directory as needed. */
export function writeResultsFile(data: TestResultsFile): void {
  const dir = path.dirname(RESULTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(data, null, 2), 'utf8');
}
