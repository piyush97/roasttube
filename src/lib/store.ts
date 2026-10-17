import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RoastReport, ScoreResult, Signals, StoredReport } from "./types.ts";

const DIR = join(process.cwd(), "data", "reports");

const ID_RE = /^[a-z0-9]{8}$/;

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function newId(): string {
  // crypto, not Math.random: report IDs guard private roast data
  const b = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ID_ALPHABET[b[i] % 36];
  return s;
}

async function ensureDir() {
  await mkdir(DIR, { recursive: true });
}

export async function saveReport(
  report: RoastReport,
  signals: Signals,
  score: ScoreResult,
  source: StoredReport["source"],
  persona?: string
): Promise<string> {
  await ensureDir();
  const stored: Omit<StoredReport, "id"> = {
    createdAt: new Date().toISOString(),
    source,
    persona,
    report,
    signals,
    score,
  };
  // wx = create-exclusive: closes the read-then-write collision race
  for (let i = 0; i < 5; i++) {
    const id = newId();
    try {
      await writeFile(join(DIR, `${id}.json`), JSON.stringify({ id, ...stored }, null, 2), {
        flag: "wx",
      });
      return id;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }
  throw new Error("could not allocate report id");
}

export async function getReport(id: string): Promise<StoredReport | null> {
  if (!ID_RE.test(id)) return null;
  try {
    return JSON.parse(await readFile(join(DIR, `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}

export async function listReports(limit = 20): Promise<StoredReport[]> {
  let files: string[];
  try {
    files = await readdir(DIR);
  } catch {
    return [];
  }
  const reports = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        try {
          return JSON.parse(
            await readFile(join(DIR, f), "utf8")
          ) as StoredReport;
        } catch {
          return null;
        }
      })
  );
  return reports
    .filter((r): r is StoredReport => r !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function deleteReport(id: string): Promise<boolean> {
  if (!ID_RE.test(id)) return false;
  try {
    await unlink(join(DIR, `${id}.json`));
    return true;
  } catch {
    return false;
  }
}
