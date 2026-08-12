import { API_TIMEOUT_MS, HEALTH_TIMEOUT_MS, request } from "./client";
import type {
  CorrectionBody,
  HealthResponse,
  OutcomeBody,
  OutcomeResult,
  PreferenceResult,
  PreferenceSummary,
  PreferenceWriteBody,
  ReadinessResponse,
  RecallBody,
  RecallTrace,
  Revision,
  ScopeIds,
} from "./types";

function scopeQuery(scope: ScopeIds): string {
  return new URLSearchParams({
    tenant_id: scope.tenant_id,
    subject_id: scope.subject_id,
  }).toString();
}

export const memoryApi = {
  health(signal?: AbortSignal): Promise<HealthResponse> {
    return request<HealthResponse>("/health", { timeoutMs: HEALTH_TIMEOUT_MS, signal });
  },

  readiness(signal?: AbortSignal): Promise<ReadinessResponse> {
    return request<ReadinessResponse>("/readyz", { timeoutMs: HEALTH_TIMEOUT_MS, signal });
  },

  list(scope: ScopeIds, signal?: AbortSignal): Promise<PreferenceSummary[]> {
    return request<PreferenceSummary[]>(`/v1/preferences?${scopeQuery(scope)}`, {
      timeoutMs: API_TIMEOUT_MS,
      signal,
    });
  },

  remember(body: PreferenceWriteBody, signal?: AbortSignal): Promise<PreferenceResult> {
    return request<PreferenceResult>("/v1/preferences", { method: "POST", body, signal });
  },

  correct(recordId: string, body: CorrectionBody, signal?: AbortSignal): Promise<PreferenceResult> {
    return request<PreferenceResult>(`/v1/preferences/${encodeURIComponent(recordId)}/corrections`, {
      method: "POST",
      body,
      signal,
    });
  },

  revisions(recordId: string, scope: ScopeIds, signal?: AbortSignal): Promise<Revision[]> {
    return request<Revision[]>(
      `/v1/preferences/${encodeURIComponent(recordId)}/revisions?${scopeQuery(scope)}`,
      { signal },
    );
  },

  recall(body: RecallBody, signal?: AbortSignal): Promise<RecallTrace> {
    return request<RecallTrace>("/v1/recall", { method: "POST", body, signal });
  },

  outcome(body: OutcomeBody, signal?: AbortSignal): Promise<OutcomeResult> {
    return request<OutcomeResult>("/v1/outcomes", { method: "POST", body, signal });
  },
};
