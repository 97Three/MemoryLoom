/** Transport contract shared with `memoryloom.api.schemas`. */

export interface ScopeIds {
  tenant_id: string;
  subject_id: string;
}

export interface PreferenceSummary {
  record_id: string;
  revision_id: string;
  sequence: number;
  key: string;
  value: string;
  context: Record<string, string>;
  confidence: number;
  support_count: number;
  evidence_count: number;
  valid_from: string;
  recorded_at: string;
}

export interface PreferenceResult {
  observation_id: string;
  candidate_id: string;
  record_id: string;
  revision_id: string;
  sequence: number;
  idempotent_replay: boolean;
}

export interface ScoreBreakdown {
  semantic: number;
  context: number;
  belief: number;
  utility: number;
  recency: number;
  lexical: number | null;
  vector: number | null;
}

export interface RecallItem {
  record_id: string;
  revision_id: string;
  key: string;
  value: string;
  context: Record<string, string>;
  revision_valid_from: string;
  revision_recorded_at: string;
  rank: number;
  score: number;
  breakdown: ScoreBreakdown;
  evidence_ids: string[];
}

export interface RecallTrace {
  trace_id: string;
  policy_id: string;
  policy_version: number;
  valid_at: string;
  known_at: string;
  created_at: string;
  items: RecallItem[];
}

export interface Revision {
  id: string;
  record_id: string;
  sequence: number;
  value: string;
  confidence: number;
  support_count: number;
  contradiction_count: number;
  source_diversity: number;
  evidence_ids: string[];
  valid_from: string;
  recorded_at: string;
  supersedes_revision_id: string | null;
}

export interface UtilityEstimate {
  mean: number;
  sample_weight: number;
  success_weight: number;
  failure_weight: number;
  outcome_count: number;
}

export interface OutcomeResult {
  outcome_id: string;
  trace_id: string;
  revision_id: string;
  kind: string;
  occurred_at: string;
  recorded_at: string;
  utility: UtilityEstimate;
  idempotent_replay: boolean;
}

export interface HealthResponse {
  status: string;
  version: string;
  storage: string;
  auth_mode: string;
  scope_source: string;
  projection: string;
}

export interface ReadinessResponse {
  status: string;
  storage: string;
}

export interface PreferenceWriteBody extends ScopeIds {
  source: string;
  idempotency_key: string;
  key: string;
  value: string;
  context: Record<string, string>;
  evidence_text: string;
  confidence: number;
}

export interface CorrectionBody extends ScopeIds {
  source: string;
  idempotency_key: string;
  value: string;
  evidence_text: string;
  reason: string;
  expected_revision_id: string;
}

export interface RecallBody extends ScopeIds {
  query: string;
  context: Record<string, string>;
  limit: number;
  valid_at?: string;
  known_at?: string;
}

export interface OutcomeBody extends ScopeIds {
  trace_id: string;
  revision_id: string;
  kind: "helpful" | "rejected";
  idempotency_key: string;
  weight: number;
  note: string;
}
