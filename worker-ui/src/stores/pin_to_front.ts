import { ref, computed } from "vue";
import { defineStore } from "pinia";

export const usePinToFront = defineStore("pinToFront", () => {
  //   const count = ref(0);
  //   const doubleCount = computed(() => count.value * 2);
  //   function increment() {
  //     count.value++;
  //   }

  //   return { count, doubleCount, increment };

  async function pin_to_front() {}
  async function cancel_pin_to_front() {}

  return { pin_to_front };
});
