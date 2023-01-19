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

export const nonCss = `
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

export const ts = `
<script lang="ts">
export default {
  data() {
    return {
      msg: 'Hello from Component A!',
    }
  },
  methods: {
    someMethod(arg: string): string {
      return 'hello ' + arg
    },
  },
}
</script>

<template>
  <h1>{{ msg }}</h1>
</template>
`

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
  1<Foo />2
</template>

<style>
  h2 { color: blue }
</style>
`;

export const scoped = `
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
  <h1 class="title">{{ msg }}</h1>
  <input v-model="msg">
</template>

<style scoped>
  .title { color: red }
</style>
`;

export const cssModules = `
<script>
export default {
  data() {
    return {
      isRed: true
    }
  }
}
</script>

<template>
  <p :class="{ [$style.red]: isRed }">
    Am I red?
  </p>
  <p :class="[$style.red, $style.bold]">
    Red and bold
  </p>
</template>

<style module>
.red {
  color: red;
}
.bold {
  font-weight: bold;
}
</style>
`;

