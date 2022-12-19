# vue-simple-compiler

**Warning: not stable enough for production yet!**

## Install

```bash
npm install vue-simple-compiler
# or
yarn add vue-simple-compiler
# or
pnpm install vue-simple-compiler
```

## Usage

```js
const [jsCode, cssCode, destFilename] = compile(source, { filename });
```

## Example

- `foo.vue`

  ```vue
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
  ```

- `main.js`

  ```js
  import { compile } from 'vue-simple-compiler'
  const [jsCode, cssCode, destFilename] = compile(
    fs.readFileSync('./foo.vue', 'utf8'),
    { filename: `foo.vue` }
  );
  ```
