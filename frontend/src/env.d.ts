/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

interface Window {
  /** Injected by the static host before the bundle boots; see `frontend.py`. */
  MEMORYLOOM_RUNTIME_CONFIG?: { apiBaseUrl?: string };
}
