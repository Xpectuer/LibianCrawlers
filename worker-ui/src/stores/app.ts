import { ref, computed } from "vue";
import { defineStore } from "pinia";

export type Nodes = {};

export const useNodesStore = defineStore("nodes", () => {
  const myIdentities = ref(null);
  const canUseIdentities = ref([]);

  return { myIdentities, canUseIdentities };
});
