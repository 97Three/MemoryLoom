/**
 * Transport layer. The API origin is resolved at runtime, never at build time:
 * the static host injects `runtime-config.js` so one build can be deployed
 * against any backend origin.
 */

const configured = window.MEMORYLOOM_RUNTIME_CONFIG?.apiBaseUrl;

export const API_BASE: string =
  typeof configured === "string" && configured.trim()
    ? configured.replace(/\/+$/, "")
    : `${window.location.protocol}//${window.location.hostname}:38089`;

export const API_TIMEOUT_MS = 12_000;
export const HEALTH_TIMEOUT_MS = 3_500;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly requestId: string | null;

  constructor(message: string, status: number, code: string | null, requestId: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export class RequestCancelledError extends Error {
  constructor() {
    super("请求已取消");
    this.name = "RequestCancelledError";
  }
}

export function isCancelled(error: unknown): boolean {
  return (
    error instanceof RequestCancelledError ||
    (error instanceof DOMException && error.name === "AbortError")
  );
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.requestId ? `${error.message}（trace ${error.requestId.slice(0, 8)}）` : error.message;
  }
  if (error instanceof Error) return error.message;
  return "未知错误";
}

export interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface ErrorPayload {
  detail?: unknown;
  error?: unknown;
  request_id?: unknown;
}

function readMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const payload = body as ErrorPayload;
    if (typeof payload.detail === "string" && payload.detail.trim()) return payload.detail;
    if (Array.isArray(payload.detail)) {
      return payload.detail
        .map((item) =>
          item && typeof item === "object" && "msg" in item
            ? String((item as { msg?: unknown }).msg ?? "参数校验失败")
            : "参数校验失败",
        )
        .join("；");
    }
  }
  return `请求失败（HTTP ${status}）`;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", forwardAbort, { once: true });

  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? API_TIMEOUT_MS);

  const init: RequestInit = {
    method: options.method ?? "GET",
    signal: controller.signal,
    headers: { "content-type": "application/json" },
  };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);

  try {
    const response = await fetch(`${API_BASE}${path}`, init);
    const contentType = response.headers.get("content-type") ?? "";
    const body: unknown = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const payload = (body ?? {}) as ErrorPayload;
      const headerId = response.headers.get("x-request-id");
      const bodyId = typeof payload.request_id === "string" ? payload.request_id : null;
      const code = typeof payload.error === "string" ? payload.error : null;
      throw new ApiError(readMessage(body, response.status), response.status, code, bodyId ?? headerId);
    }
    return body as T;
  } catch (error) {
    if (timedOut) throw new ApiError("请求超时，请确认 API 已启动后重试。", 408, "timeout", null);
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
    options.signal?.removeEventListener("abort", forwardAbort);
  }
}
