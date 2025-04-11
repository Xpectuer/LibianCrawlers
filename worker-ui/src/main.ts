import { createApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import Aura from "@primeuix/themes/aura";

import App from "./App.vue";
import router from "./router";

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
});
app.mount("#app");

function check_or_init_app_context(
  resolve: () => void,
  reject: (err: unknown) => void
) {
  console.debug("Start check or init app context");
  let init_started = false;
  let is_desktop_pywebview = false;

  window.addEventListener("pywebviewready", async () => {
    console.info("pywebviewready callbacked");
    await pywebview.api.logd("success call api from pywebview");
    is_desktop_pywebview = true;
    try_init();
  });

  setTimeout(() => {
    if (!is_desktop_pywebview) {
      console.info(
        "pywebviewready not callback , it sames like browser context"
      );
    }
    try_init();
  }, 2000);

  function try_init() {
    try {
      if (init_started) {
        console.debug("app already init");
        resolve();
        return "init_started";
      }
      let _app_context: typeof app_context;
      const _global_pywebview: any = (window as any)["pywebview"];
      console.debug("Global pywebview is ", _global_pywebview);
      if (!("pywebview" in window) && _global_pywebview === undefined) {
        console.info("Global pywebview is undefined , try mock api for it ...");
        const _pywebview: typeof pywebview = {
          token: "",
          platform: "",
          api: {
            logd: async (...args) => {
              console.debug(...args);
            },
            window_show: async () => {
              console.debug("ignore window show");
            },
            window_hide: async () => {
              console.debug("ignore window hide");
            },
          },
        };
        (window as any)["pywebview"] = _pywebview;
        console.info("Mock pywebview :", (window as any)["pywebview"]);
        _app_context = {
          is_browser_mock_pywebview: true,
          is_desktop_pywebview: false,
        };
      } else {
        _app_context = {
          is_browser_mock_pywebview: false,
          is_desktop_pywebview: true,
        };
      }
      (window as any)["app_context"] = _app_context;
      console.info("App context :", app_context);
      resolve();
    } catch (err) {
      reject(err);
    }
  }
}

await Promise.all([
  import("primeicons/primeicons.css"),
  import("./assets/main.css"),
  new Promise<void>((rs, rj) => {
    try {
      check_or_init_app_context(rs, rj);
    } catch (err) {
      rj(err);
    }
  }),
]);

console.info("All resource inited , main.ts finish");
