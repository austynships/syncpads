/** Tiny fetch wrapper for the start page API. Throws an Error with the server's message. */
export async function api<T = { revision: number }>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error ?? `Request failed (${res.status})`) as Error & { status: number; upgrade?: boolean };
    err.status = res.status;
    err.upgrade = data.upgrade === true; // a Free plan limit (SP-20)
    throw err;
  }
  return data as T;
}

