import { ensureDirSync, writeFileSync, rmSync, existsSync } from 'fs-extra'
import { expect, it } from 'vitest'
import { mount } from "@vue/test-utils";

import { compile } from "../src/compiler";
import { mvp, imports, nonCss } from "./source";
import { defineComponent } from 'vue';

// TODO:
// features
// - options: custom resolver
// complexity
// - import vue files without extension name
// - import js/css files with the same name

it('works', async () => {
  const [jsCode, cssCode, destFilename] = compile(mvp);
  expect(destFilename).toBe('anonymous.vue.js')
  if (existsSync('./test/dist/mvp')) {
    rmSync('./test/dist/mvp', { recursive: true })
  }
  ensureDirSync('./test/dist/mvp')
  writeFileSync('./test/dist/mvp/anonymous.vue.js', jsCode)
  writeFileSync('./test/dist/mvp/anonymous.vue.css', cssCode)
  const modulePath = `./dist/mvp/anonymous.vue.js`
  const HelloWorld = (await import(modulePath)).default
  const wrapper = mount(defineComponent(HelloWorld))
  expect(wrapper.html().trim().replace(/\n/g, '')).toBe('<h1>Hello World!</h1><input>')
})

it('works without <style>', async () => {
  const [jsCode, cssCode, destFilename] = compile(nonCss);
  expect(destFilename).toBe('anonymous.vue.js')
  expect(cssCode).toBe('')
  if (existsSync('./test/dist/mvp')) {
    rmSync('./test/dist/mvp', { recursive: true })
  }
  ensureDirSync('./test/dist/mvp')
  writeFileSync('./test/dist/mvp/anonymous.vue.js', jsCode)
  const modulePath = `./dist/mvp/anonymous.vue.js`
  const HelloWorld = (await import(modulePath)).default
  const wrapper = mount(defineComponent(HelloWorld))
  expect(wrapper.html().trim().replace(/\n/g, '')).toBe('<h1>Hello World!</h1><input>')
})

it('works with custom filename', async () => {
  const [jsCode, cssCode, destFilename] = compile(mvp, { filename: 'custom.vue' });
  expect(destFilename).toBe('custom.vue.js')
  if (existsSync('./test/dist/custom-filename')) {
    rmSync('./test/dist/custom-filename', { recursive: true })
  }
  ensureDirSync('./test/dist/custom-filename')
  writeFileSync('./test/dist/custom-filename/custom.vue.js', jsCode)
  writeFileSync('./test/dist/custom-filename/custom.vue.css', cssCode)
  const modulePath = `./dist/custom-filename/${destFilename}`
  const HelloWorld = (await import(modulePath)).default
  const wrapper = mount(defineComponent(HelloWorld))
  expect(wrapper.html().trim().replace(/\n/g, '')).toBe('<h1>Hello World!</h1><input>')
})

it('works with importing other vue files', async () => {
  const [jsCode, cssCode, destFilename] = compile(mvp, { filename: 'foo.vue' });
  const [jsCode2, cssCode2, destFilename2] = compile(imports, { filename: 'bar.vue' });
  expect(destFilename).toBe('foo.vue.js')
  expect(destFilename2).toBe('bar.vue.js')
  if (existsSync('./test/dist/imports')) {
    rmSync('./test/dist/imports', { recursive: true })
  }
  ensureDirSync('./test/dist/imports')
  writeFileSync('./test/dist/imports/foo.vue.js', jsCode)
  writeFileSync('./test/dist/imports/foo.vue.css', cssCode)
  writeFileSync('./test/dist/imports/bar.vue.js', jsCode2)
  writeFileSync('./test/dist/imports/bar.vue.css', cssCode2)
  const modulePath = `./dist/imports/${destFilename2}`
  const Bar = (await import(modulePath)).default
  const wrapper = mount(defineComponent(Bar))
  expect(wrapper.html().trim().replace(/\n/g, '')).toBe('1<h1>Hello World!</h1><input>2')
})

it('works with auto-import css', async() => {
  const [jsCode, cssCode, destFilename] = compile(mvp, { filename: 'foo.vue', autoImportCss: true });
  expect(destFilename).toBe('foo.vue.js')
  expect(cssCode.length).toBeGreaterThan(0)
  expect(jsCode.includes(`import './foo.vue.css'`)).toBe(true)
  if (existsSync('./test/dist/auto-import-css')) {
    rmSync('./test/dist/auto-import-css', { recursive: true })
  }
  ensureDirSync('./test/dist/auto-import-css')
  writeFileSync('./test/dist/auto-import-css/foo.vue.js', jsCode)
  writeFileSync('./test/dist/auto-import-css/foo.vue.css', cssCode)
  const modulePath = `./dist/auto-import-css/${destFilename}`
  const HelloWorld = (await import(modulePath)).default
  const wrapper = mount(defineComponent(HelloWorld))
  expect(wrapper.html().trim().replace(/\n/g, '')).toBe('<h1>Hello World!</h1><input>')
})

it('works with auto-import css without <style>', async() => {
  const [jsCode, cssCode, destFilename] = compile(nonCss, { filename: 'foo.vue', autoImportCss: true });
  expect(destFilename).toBe('foo.vue.js')
  expect(cssCode).toBe('')
  expect(jsCode.includes(`import './foo.vue.css'`)).toBe(false)
  if (existsSync('./test/dist/auto-import-css')) {
    rmSync('./test/dist/auto-import-css', { recursive: true })
  }
  ensureDirSync('./test/dist/auto-import-css')
  writeFileSync('./test/dist/auto-import-css/foo.vue.js', jsCode)
  const modulePath = `./dist/auto-import-css/${destFilename}`
  const HelloWorld = (await import(modulePath)).default
  const wrapper = mount(defineComponent(HelloWorld))
  expect(wrapper.html().trim().replace(/\n/g, '')).toBe('<h1>Hello World!</h1><input>')
})
