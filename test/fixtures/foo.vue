<template>
  <div class="foo">
    <h1>{{ title }}</h1>
    <p>This is the Foo component.</p>
  </div>
</template>

<script setup lang="ts">
import type { Props } from './types.js'

defineProps<Props>();
</script>
