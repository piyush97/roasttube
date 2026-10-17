// Report storage selector: Cloudflare KV when the ROASTTUBE_KV binding exists
// (deployed Workers / vite dev), the local filesystem everywhere else
// (next dev, node tests). Public API is unchanged for existing callers.
import type { RoastReport, ScoreResult, Signals, StoredReport } from "./types.ts";
import { getKvBinding } from "./kv.ts";
import { createKvStore } from "./store-kv.ts";
import * as fsStore from "./store-fs.ts";

type ReportStore = ReturnType<typeof createKvStore>;

let kvStore: ReportStore | null = null;

async function store(): Promise<ReportStore> {
  const kv = await getKvBinding();
  if (!kv) return fsStore;
  kvStore ??= createKvStore(kv);
  return kvStore;
}

export async function saveReport(
  report: RoastReport,
  signals: Signals,
  score: ScoreResult,
  source: StoredReport["source"],
  persona?: string
): Promise<string> {
  return (await store()).saveReport(report, signals, score, source, persona);
}

export async function getReport(id: string): Promise<StoredReport | null> {
  return (await store()).getReport(id);
}

export async function listReports(limit = 20): Promise<StoredReport[]> {
  return (await store()).listReports(limit);
}

export async function deleteReport(id: string): Promise<boolean> {
  return (await store()).deleteReport(id);
}
