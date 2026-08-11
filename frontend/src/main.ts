import { createApp } from "vue";
import { createPinia } from "pinia";

import "@/styles/tokens.scss";
import "@/styles/base.scss";
import "@/styles/element-override.scss";

import App from "./App.vue";
import { router } from "./router";

/*
 * Element Plus is not installed as a plugin: components and their styles are
 * resolved on demand by `unplugin-vue-components`, and the locale is provided by
 * `<el-config-provider>` in App.vue.
 */
createApp(App).use(createPinia()).use(router).mount("#app");
