import { computed, ref } from "vue";
import { defineStore } from "pinia";

export type Nodes = {};

export const useNodesStore = defineStore("nodes", () => {
  const myIdentities = ref(null);
  async function call_generate_new_identitiy(pri_key_password: string) {
    console.debug("call_generate_new_identitiy", { pri_key_password });
    const res = await pywebview.api.generate_new_identity(pri_key_password);
    console.debug("generate_new_identity result", { res });
  }

  return { myIdentities, call_generate_new_identitiy };
});
