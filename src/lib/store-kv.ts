import type { RoastReport, ScoreResult, Signals, StoredReport } from "./types.ts";
import { ID_RE, newId } from "./ids.ts";
import type { KvLike } from "./kv.ts";

const REPORT_PREFIX = "report:";

export function createKvStore(kv: KvLike) {
  return {
    async saveReport(
      report: RoastReport,
      signals: Signals,
      score: ScoreResult,
      source: StoredReport["source"],
      persona?: string
    ): Promise<string> {
      // Single attempt: KV has no create-exclusive write, and collisions in a
      // 36^8 id space are negligible (the fs store retries EEXIST instead).
      const id = newId();
      const stored: StoredReport = {
        id,
        createdAt: new Date().toISOString(),
        source,
        persona,
        report,
        signals,
        score,
      };
      await kv.put(REPORT_PREFIX + id, JSON.stringify(stored));
      return id;
    },

    async getReport(id: string): Promise<StoredReport | null> {
      if (!ID_RE.test(id)) return null;
      const raw = await kv.get(REPORT_PREFIX + id);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as StoredReport;
      } catch {
        return null;
      }
    },

    async listReports(limit = 20): Promise<StoredReport[]> {
      const { keys } = await kv.list({ prefix: REPORT_PREFIX, limit: 1000 });
      const reports = await Promise.all(
        keys.map(async ({ name }) => {
          try {
            return JSON.parse((await kv.get(name)) ?? "null") as StoredReport | null;
          } catch {
            return null;
          }
        })
      );
      return reports
        .filter((r): r is StoredReport => r !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async deleteReport(id: string): Promise<boolean> {
      if (!ID_RE.test(id)) return false;
      // KV deletes are idempotent; report success for any well-formed id.
      await kv.delete(REPORT_PREFIX + id);
      return true;
    },
  };
}
