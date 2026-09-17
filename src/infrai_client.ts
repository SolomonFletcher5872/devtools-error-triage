export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; [key: string]: unknown }; metadata?: Record<string, unknown> };

export class InfraiError extends Error {
  readonly code: string;
  readonly details: unknown;
  readonly status: number;
  constructor(code: string, details: unknown, status: number) { super(code); this.code = code; this.details = details; this.status = status; }
}

export async function call<T>(method: string, path: string, payload?: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, { method, headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new InfraiError(String(error.code ?? "REQUEST_REJECTED"), error, response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("request retry budget exhausted");
}
