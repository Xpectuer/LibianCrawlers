<script setup lang="ts">
import { ref, shallowRef } from "vue";
import { useAsyncState } from "@vueuse/core";
import { useNodesStore } from "./stores/app";
import IdentityInitView from "./views/IdentityInitView.vue"

const api = shallowRef(pywebview.api);
const { myIdentities, call_generate_new_identitiy } = useNodesStore();
const show_input_aes_password = ref(false)

const app_bar_items = ref([
  {
    label: "概览",
    to: "/",
  },
  {
    label: "任务",
    to: "/tasks",
  },
  {
    label: "节点",
    to: "/nodes",
  },
  {
    label: "设置",
    to: "/setting",
  },
  {
    label: "关于",
    to: "/about",
  },
]);
</script>

<template>
  <n-modal-provider>
    <n-dialog-provider>
      <div v-if="myIdentities" class="flex flex-col h-full">
        <!-- app top bar -->
        <nav class="px-4">
          <n-tabs type="line">
            <n-tab :name="app_bar_item.label" v-for="app_bar_item in app_bar_items">
              <router-link :to="app_bar_item.to">{{
                app_bar_item.label
              }}</router-link>
            </n-tab>
          </n-tabs>
        </nav>
        <!-- router view -->
        <RouterView />
      </div>
      <IdentityInitView id="identity-init" v-else class="flex h-screen" />
    </n-dialog-provider>
  </n-modal-provider>
</template>

<style scoped></style>
