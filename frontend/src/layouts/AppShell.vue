<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { CircleCheck, Grid, Link, Menu, Plus, Search, Collection, Share } from "@element-plus/icons-vue";

import { API_BASE } from "@/api/client";
import ScopeSwitcher from "@/components/ScopeSwitcher.vue";
import TourDialog from "@/components/TourDialog.vue";
import { useConsole } from "@/stores/console";

const store = useConsole();
const route = useRoute();

const links = [
  { name: "overview", label: "工作台", icon: Grid },
  { name: "recall", label: "召回", icon: Search },
  { name: "memories", label: "记忆", icon: Collection },
  { name: "capture", label: "写入", icon: Plus },
  { name: "architecture", label: "架构", icon: Share },
];

const activeName = computed(() => (typeof route.name === "string" ? route.name : "overview"));
const menuOpen = ref(false);

let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  store.refreshHealth();
  // `?tour=1` forces the tour open even after it was dismissed; `?tour=0` suppresses it.
  const tourMode = new URLSearchParams(window.location.search).get("tour");
  if (tourMode === "0") store.closeTour(false);
  else store.openTour(tourMode === "1");
  timer = globalThis.setInterval(() => {
    if (store.health !== "checking") void store.refreshHealth();
  }, 30_000);
});

onBeforeUnmount(() => {
  if (timer !== undefined) globalThis.clearInterval(timer);
});
</script>

<template>
  <div class="shell">
    <header class="nav">
      <div class="nav-inner">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9">
              <path d="M4 7.5c3.6-2 6-2 8 0s4.4 2 8 0" stroke-linecap="round" />
              <path d="M4 12.5c3.6-2 6-2 8 0s4.4 2 8 0" stroke-linecap="round" opacity=".7" />
              <path d="M4 17.5c3.6-2 6-2 8 0s4.4 2 8 0" stroke-linecap="round" opacity=".45" />
            </svg>
          </span>
          <span>
            <span class="brand-name">MemoryLoom</span>
            <span class="brand-sub">MEMORY CONSOLE</span>
          </span>
        </div>

        <nav class="nav-links" aria-label="主导航">
          <router-link
            v-for="item in links"
            :key="item.name"
            :to="{ name: item.name }"
            class="nav-link"
            :class="{ 'is-active': activeName === item.name }"
            :aria-current="activeName === item.name ? 'page' : undefined"
          >
            {{ item.label }}
          </router-link>
        </nav>

        <div class="nav-right">
          <ScopeSwitcher />
          <el-popover placement="bottom-end" :width="300" trigger="click">
            <template #reference>
              <button class="health-pill" type="button" :class="`is-${store.health}`">
                <span class="lights" aria-hidden="true" />
                {{ store.healthLabel }}
              </button>
            </template>
            <div class="health-pop">
              <p class="health-title">
                <el-icon><CircleCheck /></el-icon>
                {{ store.healthDetail }}
              </p>
              <p class="hint">{{ store.storageTitle }}：{{ store.storageCopy }}</p>
              <p class="hint">
                作用域来源：{{ store.authMode === "jwt" ? "可信 access token" : "请求体（开发合同）" }}
              </p>
              <div class="health-actions">
                <el-button size="small" @click="store.refreshHealth()">重新检查</el-button>
                <a class="health-link" :href="`${API_BASE}/docs`" target="_blank" rel="noreferrer">
                  <el-icon><Link /></el-icon> OpenAPI
                </a>
              </div>
            </div>
          </el-popover>
          <el-button size="small" text class="tour-trigger" @click="store.openTour(true)">
            新手引导
          </el-button>
          <button class="nav-burger" type="button" aria-label="打开导航" @click="menuOpen = true">
            <el-icon><Menu /></el-icon>
          </button>
        </div>
      </div>
    </header>

    <el-drawer v-model="menuOpen" direction="rtl" size="76%" :with-header="false" append-to-body>
      <nav class="drawer-nav" aria-label="移动端导航">
        <p class="drawer-title">MemoryLoom · 记忆工作台</p>
        <button
          v-for="item in links"
          :key="item.name"
          type="button"
          class="drawer-link"
          :class="{ 'is-active': activeName === item.name }"
          @click="menuOpen = false; $router.push({ name: item.name })"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          {{ item.label }}
        </button>
        <div class="drawer-scope">
          <span class="label">当前作用域</span>
          <span class="chip">{{ store.scope.tenant_id }} / {{ store.scope.subject_id }}</span>
          <span class="hint">{{ store.healthLabel }} · {{ store.storageTitle }}</span>
        </div>
      </nav>
    </el-drawer>

    <main id="main-content" class="main">
      <div class="wrap">
        <slot />
      </div>
    </main>

    <nav class="tabbar" aria-label="底部导航">
      <router-link
        v-for="item in links"
        :key="item.name"
        :to="{ name: item.name }"
        class="tab-item"
        :class="{ 'is-active': activeName === item.name }"
        :aria-current="activeName === item.name ? 'page' : undefined"
      >
        <el-icon><component :is="item.icon" /></el-icon>
        <span>{{ item.label }}</span>
      </router-link>
    </nav>

    <TourDialog />
  </div>
</template>

<style scoped>
.health-pop {
  display: grid;
  gap: 8px;
}

.health-title {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ink);
}

.health-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.health-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--brand);
  text-decoration: none;
}

.nav-burger {
  display: none;
  width: 34px;
  height: 34px;
  border-radius: var(--r);
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink2);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--sh-sm);
}

.drawer-nav {
  display: grid;
  gap: 4px;
}

.drawer-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.3px;
}

.drawer-link {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 10px;
  border: none;
  border-radius: var(--r);
  background: transparent;
  font: inherit;
  font-size: 13.5px;
  color: var(--ink2);
  cursor: pointer;
  text-align: left;
}

.drawer-link.is-active {
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 600;
}

.drawer-scope {
  display: grid;
  gap: 6px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--line2);
}

.drawer-scope .chip {
  justify-self: start;
}

.tabbar {
  display: none;
}

@media (max-width: 1080px) {
  .nav-burger {
    display: inline-flex;
  }

  .tour-trigger {
    display: none;
  }
}

@media (max-width: 768px) {
  /* Phones get a fixed bottom bar, so the drawer button would be redundant. */
  .nav-burger {
    display: none;
  }

  .tabbar {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc(54px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: rgba(255, 255, 255, 0.94);
    backdrop-filter: blur(16px);
    border-top: 1px solid var(--line);
    z-index: 30;
  }

  .tab-item {
    display: grid;
    place-items: center;
    gap: 1px;
    font-size: 10.5px;
    color: var(--ink3);
    text-decoration: none;
  }

  .tab-item.is-active {
    color: var(--brand);
    font-weight: 600;
  }

  .main {
    padding-bottom: 58px;
  }
}
</style>
