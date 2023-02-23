export const sourceMap = `
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

export const sass = `
<template>
  <nav>
    <ul>
      <li><a href="#">Home</a></li>
      <li><a href="#">About</a></li>
      <li><a href="#">Contact</a></li>
    </ul>
  </nav>
</template>

<style lang="scss">
$font-stack: Helvetica, sans-serif;
$primary-color: #333;

nav {
  font: 100% $font-stack;
  background: $primary-color;

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li { display: inline-block; }

  a {
    display: block;
    padding: 6px 12px;
    text-decoration: none;
  }
}
</style>
`;

export const externalJs = `
<script src="./external.js"></script>

<template>
  <h1>{{ msg }}</h1>
  <input v-model="msg">
</template>

<style>
  h1 { color: red }
</style>
`;

export const externalJsAsset = `
import { ref } from 'vue'
export default {
  setup() {
    const msg = ref('Hello World!')
    return { msg }
  }
}
`

export const externalTs = `
<script lang="ts" src="./external.ts"></script>

<template>
  <h1>{{ msg }}</h1>
</template>
`;

export const externalTsAsset = `
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
`

export const externalCss = `
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

<style src="./external.css"></style>
`;

export const externalCssAsset = `
h1 { color: red }
`

export const externalSass = `
<template>
  <nav>
    <ul>
      <li><a href="#">Home</a></li>
      <li><a href="#">About</a></li>
      <li><a href="#">Contact</a></li>
    </ul>
  </nav>
</template>

<style lang="scss" src="./external.scss"></style>
`;

export const externalSassAsset = `
$font-stack: Helvetica, sans-serif;
$primary-color: #333;

nav {
  font: 100% $font-stack;
  background: $primary-color;

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li { display: inline-block; }

  a {
    display: block;
    padding: 6px 12px;
    text-decoration: none;
  }
}
`

export const externalScoped = `
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

<style scoped src="./external.css"></style>
`;

export const externalScopedAsset = `
.title { color: red }
`

export const externalCssModules = `
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

<style module src="./external.module.css"></style>
`;

export const externalCssModulesAsset = `.red {
  color: red;
}
.bold {
  font-weight: bold;
}
`;

