<script setup lang="ts">
import { ref, shallowRef } from "vue";
import { useAsyncState } from "@vueuse/core";
import { useNodesStore } from "./stores/app";

const api = shallowRef(pywebview.api);
const nodesState = useNodesStore();

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
  <div v-if="nodesState.myIdentities" class="flex flex-col h-full">
    <!-- app top bar -->
    <div class="px-4">
      <n-tabs type="line">
        <n-tab :name="app_bar_item.label" v-for="app_bar_item in app_bar_items">
          <router-link :to="app_bar_item.to">{{
            app_bar_item.label
          }}</router-link>
        </n-tab>
      </n-tabs>
    </div>
    <RouterView />
  </div>
  <div v-else class="flex h-screen">
    <div class="m-auto">
      <p>在启动之前，需要设定本节点的身份。身份会</p>
    </div>
  </div>
</template>

<style scoped></style>
