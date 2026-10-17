// KV-like storage. On Cloudflare Workers this resolves to the ROASTTUBE_KV
// binding declared in cloudflare.config.ts. Everywhere else (next dev, node
// tests) the dynamic import below fails and callers fall back to local state.

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string }[] }>;
}

type Entry = { value: string; expiresAt: number | null };

// Process-local KV for dev and tests: same interface, injectable clock.
export class MapKv implements KvLike {
  private entries = new Map<string, Entry>();
  private now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async get(key: string): Promise<string | null> {
    const e = this.entries.get(key);
    if (!e) return null;
    if (e.expiresAt !== null && e.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    return e.value;
  }

  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    this.entries.set(key, {
      value,
      expiresAt: opts?.expirationTtl ? this.now() + opts.expirationTtl * 1000 : null,
    });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async list(opts?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string }[] }> {
    const now = this.now();
    const names: string[] = [];
    for (const [name, e] of this.entries) {
      if (e.expiresAt !== null && e.expiresAt <= now) {
        this.entries.delete(name);
        continue;
      }
      if (opts?.prefix && !name.startsWith(opts.prefix)) continue;
      names.push(name);
    }
    names.sort();
    return { keys: names.slice(0, opts?.limit ?? names.length).map((name) => ({ name })) };
  }
}

type WorkersModule = { env?: Record<string, unknown> };

let modulePromise: Promise<WorkersModule | null> | null = null;

// The specifier must stay non-analyzable (variable, not a literal call site):
// plain Next/Node throws on import and we fall back; under workerd it resolves
// to the Workers env. Verified in the 2026-10-17 spike.
function loadWorkersModule(): Promise<WorkersModule | null> {
  modulePromise ??= (async () => {
    try {
      const spec = "cloudflare:workers";
      return (await import(/* @vite-ignore */ spec)) as WorkersModule;
    } catch {
      return null;
    }
  })();
  return modulePromise;
}

export async function getKvBinding(): Promise<KvLike | null> {
  const mod = await loadWorkersModule();
  const kv = mod?.env?.ROASTTUBE_KV;
  return kv && typeof (kv as KvLike).get === "function" ? (kv as KvLike) : null;
}

const localKv = new MapKv();

export async function getKv(): Promise<KvLike> {
  return (await getKvBinding()) ?? localKv;
}
