export const mvp = `
<script>
import { ref } from 'vue'
export default {
  setup() {
		const msg = ref('Hello World!')
    return { msg }
  }
}
</script>

<template>
  <h1>{{ msg }}</h1>
  <input v-model="msg">
</template>

<style>
  h1 { color: red }
</style>
`;

export const setup = `
<script setup>
import { ref } from 'vue'

const msg = ref('Hello World!')
</script>

<template>
  <h1>{{ msg }}</h1>
  <input v-model="msg">
</template>

<style>
  h1 { color: red }
</style>
`;

export const imports = `
<script>
import Foo from './foo.vue'
export default {
  components: {
    Foo
  }
}
</script>

<template>
  <Foo />
</template>

<style>
  h2 { color: blue }
</style>
`;
