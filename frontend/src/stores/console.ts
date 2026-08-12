import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { ApiError, describeError, isCancelled } from "@/api/client";
import { memoryApi } from "@/api/memory";
import type { PreferenceSummary, RecallTrace, ScopeIds } from "@/api/types";
import { DEMO_MEMORIES } from "@/demo/seed";
import { idempotencyKey } from "@/utils/idempotency";

const SCOPE_STORAGE_KEY = "memoryloom.scope.v1";
const JOURNEY_PREFIX = "memoryloom.journey.v1:";
const TOUR_STORAGE_KEY = "memoryloom.tour.v1";

export class ScopeChangedError extends Error {
  constructor() {
    super("作用域已切换，请求已取消");
    this.name = "ScopeChangedError";
  }
}

export type HealthState = "checking" | "online" | "not-ready" | "offline";
export type JourneyKey = "write" | "view" | "recall" | "outcome";

export interface Activity {
  id: number;
  kind: "write" | "recall" | "outcome" | "correction";
  title: string;
  detail: string;
  at: string;
}

export interface Journey {
  write: boolean;
  view: boolean;
  recall: boolean;
  outcome: boolean;
}

function emptyJourney(): Journey {
  return { write: false, view: false, recall: false, outcome: false };
}

function readScope(): ScopeIds {
  try {
    const saved = JSON.parse(localStorage.getItem(SCOPE_STORAGE_KEY) ?? "null") as Partial<ScopeIds> | null;
    if (saved && typeof saved.tenant_id === "string" && typeof saved.subject_id === "string") {
      if (saved.tenant_id.trim() && saved.subject_id.trim()) {
        return { tenant_id: saved.tenant_id, subject_id: saved.subject_id };
      }
    }
  } catch {
    // A corrupt or unavailable store must not block the console.
  }
  return { tenant_id: "demo", subject_id: "alice" };
}

function journeyKey(scope: ScopeIds): string {
  return `${JOURNEY_PREFIX}${scope.tenant_id}\u001f${scope.subject_id}`;
}

function readJourney(scope: ScopeIds): Journey {
  try {
    const saved = JSON.parse(localStorage.getItem(journeyKey(scope)) ?? "null") as Partial<Journey> | null;
    if (!saved || typeof saved !== "object") return emptyJourney();
    return {
      write: saved.write === true,
      view: saved.view === true,
      recall: saved.recall === true,
      outcome: saved.outcome === true,
    };
  } catch {
    return emptyJourney();
  }
}

function persistJourney(scope: ScopeIds, journey: Journey): void {
  try {
    localStorage.setItem(journeyKey(scope), JSON.stringify(journey));
  } catch {
    // The console stays usable when storage is unavailable or full.
  }
}

/*
 * Scope generation and per-channel controllers live outside the reactive store:
 * switching scope must invalidate every in-flight response without paying a
 * reactivity cost for the bookkeeping.
 */
let generation = 0;
const channelControllers = new Map<string, AbortController>();

export const useConsole = defineStore("console", () => {
  const scope = ref<ScopeIds>(readScope());
  const draft = ref<ScopeIds>({ ...readScope() });
  const memories = ref<PreferenceSummary[]>([]);
  const memoriesLoaded = ref(false);
  const loadingMemories = ref(false);
  const counts = ref({ writes: 0, recalls: 0, outcomes: 0, results: 0 });
  const activities = ref<Activity[]>([]);
  const journey = ref<Journey>(readJourney(readScope()));
  const health = ref<HealthState>("checking");
  const healthDetail = ref("检查 API 状态…");
  const storage = ref("unknown");
  const authMode = ref("unknown");
  const version = ref("");
  const lastTrace = ref<RecallTrace | null>(null);
  const tourOpen = ref(false);

  let activitySequence = 0;

  const scopeLabel = computed(() => `${scope.value.tenant_id} / ${scope.value.subject_id}`);
  const draftDirty = computed(
    () =>
      draft.value.tenant_id !== scope.value.tenant_id ||
      draft.value.subject_id !== scope.value.subject_id,
  );
  const draftValid = computed(
    () => Boolean(draft.value.tenant_id.trim() && draft.value.subject_id.trim()),
  );
  const persistentStorage = computed(() => storage.value === "postgres");
  const storageTitle = computed(() =>
    persistentStorage.value ? "PostgreSQL 权威存储" : "后端进程内存",
  );
  const storageCopy = computed(() =>
    persistentStorage.value
      ? "记忆、修订、Trace 与 Outcome 持久化在 PostgreSQL，进程或容器重启后仍然保留。"
      : "当前没有写入浏览器、文件或数据库；后端重启后全部权威记忆都会清空。",
  );
  const authLabel = computed(() => (authMode.value === "jwt" ? "JWT 权限" : "开发身份"));
  const healthLabel = computed(() => {
    if (health.value === "online") return "API 在线";
    if (health.value === "not-ready") return "依赖未就绪";
    if (health.value === "offline") return "API 离线";
    return "正在连接";
  });
  const completedSteps = computed(
    () => Object.values(journey.value).filter(Boolean).length,
  );

  /** Run one request under scope generation and channel cancellation. */
  async function scoped<T>(channel: string, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const startedIn = generation;
    const previous = channelControllers.get(channel);
    previous?.abort();
    const controller = new AbortController();
    channelControllers.set(channel, controller);
    try {
      const result = await run(controller.signal);
      if (startedIn !== generation) throw new ScopeChangedError();
      return result;
    } finally {
      if (channelControllers.get(channel) === controller) channelControllers.delete(channel);
    }
  }

  function cancelScopedRequests(): void {
    generation += 1;
    for (const controller of channelControllers.values()) controller.abort();
    channelControllers.clear();
  }

  /**
   * Keys are derived from the payload itself, so an unchanged form always maps to
   * the same key (a safe retry replays one write) while an edited form maps to a
   * new key (a genuinely new revision). Caching by operation would make the second
   * different write collide on the original key and return 409.
   */
  function idempotency(prefix: string, payload: unknown): string {
    return idempotencyKey(prefix, payload);
  }

  function markJourney(key: JourneyKey): void {
    if (journey.value[key]) return;
    journey.value = { ...journey.value, [key]: true };
    persistJourney(scope.value, journey.value);
  }

  function resetJourney(): void {
    journey.value = emptyJourney();
    persistJourney(scope.value, journey.value);
  }

  function addActivity(kind: Activity["kind"], title: string, detail: string): void {
    activitySequence += 1;
    activities.value = [
      { id: activitySequence, kind, title, detail, at: new Date().toISOString() },
      ...activities.value,
    ].slice(0, 8);
  }

  function bumpCount(counter: "writes" | "recalls" | "outcomes", by = 1): void {
    counts.value = { ...counts.value, [counter]: counts.value[counter] + by };
  }

  async function loadMemories(silent = false): Promise<void> {
    loadingMemories.value = true;
    try {
      const items = await scoped("memories", (signal) => memoryApi.list(scope.value, signal));
      memories.value = items;
      memoriesLoaded.value = true;
      if (items.length === 0) resetJourney();
      else markJourney("write");
    } catch (error) {
      if (isCancelled(error) || error instanceof ScopeChangedError) return;
      memoriesLoaded.value = true;
      if (!silent) healthDetail.value = describeError(error);
    } finally {
      loadingMemories.value = false;
    }
  }

  /**
   * Seed a representative dataset into the current scope. Keys are stable, so a
   * second click replays the same writes instead of duplicating every record.
   * The first failure is surfaced to the caller: "8 条全失败" without a reason is
   * how a CORS misconfiguration hides as a mysterious data problem.
   */
  async function seedDemo(): Promise<{
    created: number;
    replayed: number;
    failed: number;
    firstError: string | null;
  }> {
    let created = 0;
    let replayed = 0;
    let failed = 0;
    let firstError: string | null = null;
    for (const item of DEMO_MEMORIES) {
      const payload = {
        ...scope.value,
        source: item.source,
        key: item.key,
        value: item.value,
        context: item.context,
        evidence_text: item.evidence,
        confidence: item.confidence,
      };
      try {
        const result = await scoped(`demo:${item.slug}`, (signal) =>
          memoryApi.remember(
            {
              ...payload,
              // Literal key, identical to examples/seed_demo.py, so CLI and console
              // seeding collapse onto the same records instead of reinforcing twice.
              idempotency_key: `memoryloom:demo:${item.slug}`,
            },
            signal,
          ),
        );
        if (result.idempotent_replay) replayed += 1;
        else created += 1;
      } catch (error) {
        if (isCancelled(error)) continue;
        if (error instanceof ScopeChangedError) {
          return { created, replayed, failed: failed + 1, firstError: error.message };
        }
        failed += 1;
        if (firstError === null) firstError = describeError(error);
      }
    }
    await loadMemories(true);
    if (created > 0) {
      markJourney("write");
      counts.value = { ...counts.value, writes: counts.value.writes + created };
      addActivity("write", "载入演示数据", `${created} 条新记忆`);
    }
    return { created, replayed, failed, firstError };
  }

  async function refreshHealth(): Promise<void> {
    health.value = "checking";
    healthDetail.value = "检查 API 状态…";
    const controller = new AbortController();
    try {
      const [healthResult, readinessResult] = await Promise.allSettled([
        memoryApi.health(controller.signal),
        memoryApi.readiness(controller.signal),
      ]);
      if (healthResult.status === "rejected") throw healthResult.reason;
      const info = healthResult.value;
      storage.value = info.storage;
      authMode.value = info.auth_mode;
      version.value = info.version;
      const metadata = `v${info.version} · ${info.storage === "postgres" ? "PostgreSQL" : "进程内存"} · ${
        info.auth_mode === "jwt" ? "JWT 权限" : "开发身份"
      }`;
      if (readinessResult.status === "rejected") {
        health.value = "not-ready";
        healthDetail.value = `${metadata} · ${describeError(readinessResult.reason)}`;
        return;
      }
      if (readinessResult.value.status !== "ready") {
        health.value = "not-ready";
        healthDetail.value = `${metadata} · 依赖检查尚未通过`;
        return;
      }
      health.value = "online";
      healthDetail.value = metadata;
    } catch (error) {
      health.value = "offline";
      healthDetail.value = describeError(error);
    }
  }

  async function applyScope(next: ScopeIds): Promise<{ changed: boolean; error?: string }> {
    const tenant = next.tenant_id.trim();
    const subject = next.subject_id.trim();
    if (!tenant || !subject) return { changed: false, error: "租户和用户都不能为空" };
    if (tenant === scope.value.tenant_id && subject === scope.value.subject_id) {
      await loadMemories(true);
      return { changed: false };
    }
    cancelScopedRequests();
    scope.value = { tenant_id: tenant, subject_id: subject };
    draft.value = { tenant_id: tenant, subject_id: subject };
    memories.value = [];
    memoriesLoaded.value = false;
    lastTrace.value = null;
    journey.value = readJourney(scope.value);
    try {
      localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(scope.value));
    } catch {
      // Switching scope still works without persistence.
    }
    await loadMemories(true);
    return { changed: true };
  }

  function openTour(force = false): void {
    tourOpen.value = force || localStorage.getItem(TOUR_STORAGE_KEY) !== "done";
  }

  function closeTour(markSeen = true): void {
    tourOpen.value = false;
    if (markSeen) {
      try {
        localStorage.setItem(TOUR_STORAGE_KEY, "done");
      } catch {
        // Not fatal.
      }
    }
  }

  return {
    scope,
    draft,
    memories,
    memoriesLoaded,
    loadingMemories,
    counts,
    activities,
    journey,
    health,
    healthDetail,
    storage,
    authMode,
    version,
    lastTrace,
    tourOpen,
    scopeLabel,
    draftDirty,
    draftValid,
    persistentStorage,
    storageTitle,
    storageCopy,
    authLabel,
    healthLabel,
    completedSteps,
    scoped,
    cancelScopedRequests,
    idempotency,
    markJourney,
    resetJourney,
    addActivity,
    bumpCount,
    loadMemories,
    seedDemo,
    refreshHealth,
    applyScope,
    openTour,
    closeTour,
  };
});

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
