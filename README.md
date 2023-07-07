# vue-simple-compiler

A lib to compile Vue Single-File Component into plain JavaScript & CSS.

## Install

```bash
npm install vue-simple-compiler
# or
yarn add vue-simple-compiler
# or
pnpm install vue-simple-compiler
```

## Usage

```ts
// Main API

export const compile = (source: string, options?: CompilerOptions) => CompileResult;

// Options

type FileResolver = (filename: string) => string;

type CompilerOptions = {
  // the filename of the source code
  // - by default, it's `anonymous.vue`
  filename?: string;
  // custom file resolver
  // - by default, it's `(x) => x`
  resolver?: FileResolver;
  // whether to add CSS imports into JavaScript code
  autoImportCss?: boolean;
  // whether to resolve imports in `<script>` like:
  // - `*.ts` into `*.js`
  // - `*.vue` into `*.vue.js`
  autoResolveImports?: boolean;
  // whether to compile the code for production|development mode
  isProd?: boolean;
};

// Output

type CompileResultFile = {
  filename: string;
  code: string;
  sourceMap?: RawSourceMap | undefined;
};

type CompileResultExternalFile = {
  filename: string;
  query: Record<string, string>;
}

type CompileResult = {
  js: CompileResultFile;
  css: CompileResultFile[];
  externalJs: CompileResultExternalFile[];
  externalCss: CompileResultExternalFile[];
  errors: Error[];
};
```

### Input

- The default `filename` option is `anonymous.vue`.
- The default `resolver` option is `(x) => x`.

### Output

- The output usually has:
  - one and only one JS file (including filepath, content, and source map),
  - a list of CSS files (including filepath, content, and source map),
  - a list of external JS files (only filepath), and
  - a list of external CSS files (only filepath).
- The list of CSS files is possibly empty if there is no CSS code parsed and generated.
- The filename of JS file is usually `*.vue.js`.
- The filename of CSS file is usually `*.vue__<index>.css`.
- The ES imports of CSS files will has query parameters.
  - `scoped` and `id` are used for scoped CSS.
  - `module` is used for CSS Modules.
  - `lang.<lang>` or `lang.module.<lang>` at the end. e.g. `lang.scss`, `lang.module.less`, etc.

## Features

- ✅ Support Vue Single-File Component (SFC) syntax.
- For `<script>`
  - ✅ Support TypeScript.
  - ✅ Support `<script setup>`.
- For `<style>`
  - ✅ Support CSS Modules.
  - ✅ Support `<style scoped>`.
  - ✅ Support Sass/SCSS/Less.
- For output format
  - ✅ Support custom file resolver.
  - ✅ Support whether to add CSS imports into JavaScript code.
- ✅ Support generating source map.
- ✅ Support imported scripts and styles (`src` attributes in `<script>` and `<style>`).
  - ❎ Not support imported setup scripts or templates (`src` attributes in `<script setup>` or `<template>`).

## Example

```ts
import { compile } from 'vue-simple-compiler';

const code = `
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
`
const {
  js,
  css,
  // externalJs,
  // externalCss,
  // errors
} = compile(code, {
  filename: 'foo.vue',
  autoImportCss: true,
  autoResolveImports: true,
  isProd: true
});

js.filename; // `foo.vue.js`
js.code; // JavaScript code
js.sourceMap; // Source map of JavaScript code

css[0].filename; // `foo.vue__0.css`
css[0].code; // CSS code
css[0].sourceMap; // Source map of CSS code
```
