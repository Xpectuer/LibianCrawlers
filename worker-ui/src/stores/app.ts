import { ref, computed } from "vue";
import { defineStore } from "pinia";

export const useCounterStore = defineStore("counter", () => {
  const count = ref(0);
  const doubleCount = computed(() => count.value * 2);
  function increment() {
    count.value++;
  }

  return { count, doubleCount, increment };
});

export const useAppSuspend = defineStore("appSuspend", () => {
  const isAppSuspend = ref(false);
  async function suspendApp() {
    isAppSuspend.value = true;
  }
  async function resumeApp() {
    isAppSuspend.value = false;
  }

  return { isAppSuspend, suspendApp, resumeApp };
});
