import type { ApiError } from "../shared/api";

export class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiError["code"] | undefined,
    message: string,
  ) {
    super(message);
  }
}

export async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as T & Partial<ApiError>;
  if (!res.ok) throw new RequestError(res.status, data.code, data.error ?? `HTTP ${res.status}`);
  return data;
}
