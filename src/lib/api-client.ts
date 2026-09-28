"use client";

/** `code` is the server's stable error key (e.g. "err.banned"); `message` is already translated. */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string | null,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { error, code } = data as { error?: string; code?: string };
    throw new ApiError(error ?? `Request failed (${res.status})`, code ?? null, res.status);
  }
  return data as T;
}
