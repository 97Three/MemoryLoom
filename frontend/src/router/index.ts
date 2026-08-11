import { createRouter, createWebHashHistory } from "vue-router";

/*
 * Hash history is deliberate: the console is served by a static file server with
 * no rewrite rule, and the API contract must not change for a cosmetic rewrite.
 */
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/overview" },
    {
      path: "/overview",
      name: "overview",
      component: () => import("@/views/OverviewView.vue"),
      meta: { title: "工作台" },
    },
    {
      path: "/capture",
      name: "capture",
      component: () => import("@/views/CaptureView.vue"),
      meta: { title: "写入" },
    },
    {
      path: "/memories",
      name: "memories",
      component: () => import("@/views/MemoriesView.vue"),
      meta: { title: "记忆" },
    },
    {
      path: "/recall",
      name: "recall",
      component: () => import("@/views/RecallView.vue"),
      meta: { title: "召回" },
    },
    {
      path: "/architecture",
      name: "architecture",
      component: () => import("@/views/ArchitectureView.vue"),
      meta: { title: "架构" },
    },
    { path: "/:pathMatch(.*)*", redirect: "/overview" },
  ],
});

router.afterEach((to) => {
  const title = typeof to.meta.title === "string" ? to.meta.title : "";
  document.title = title ? `MemoryLoom · ${title}` : "MemoryLoom · 记忆工作台";
});
