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

options

- `filename`: By default it's `anonymous.vue`.
- `resolver`: A function to resolve the real filepath (e.g. add `.js` extension name automatically like `./foo` to `./foo.js`). By default it's `(x) => x`.
- `autoImportCss`: A boolean value to determine whether to necessarily prepend `import "./xxx.css"` into the generated JavaScript code. By default it's `false`.

output

- `jsCode`: Generated JavaScript code.
- `cssCode`: Generated CSS code. If there is no CSS in the source, then it would be an empty string.
- `destFilename`: The file name of the generated JavaScript file. Usually, it's like `xxx.vue.js`.

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
