<script setup lang="ts"></script>

<template>
  <!-- app top bar -->
  <div class="sticky top-0">
    <div class="flex flex-row-reverse">
      <Button
        icon="pi pi-times"
        severity="danger"
        variant="text"
        aria-label="Close"
      />
      <Button
        icon="pi pi-minus"
        severity="contrast"
        variant="text"
        aria-label="Minimize"
      />
      <Button
        icon="pi pi-thumbtack"
        severity="contrast"
        variant="text"
        aria-label="Pin"
      />
    </div>
  </div>
  <!-- app side bar -->
  <div class="flex flex-row h-full">
    <!-- app side bar -->
    <div class="flex flex-col min-w-1/5 h-full">aaaa</div>
    <!-- app router view -->
    <div class="flex flex-col grow h-full">
      <RouterView />
    </div>
  </div>
</template>

<style scoped></style>
