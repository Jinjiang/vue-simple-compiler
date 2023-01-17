import { ensureDirSync, writeFileSync, rmSync, existsSync } from 'fs-extra'
import { expect, it } from 'vitest'
import { mount } from "@vue/test-utils";

import { compile } from "../src/compiler";
import { mvp, imports, nonCss, scoped } from "./source";
import { defineComponent } from 'vue';

// TODO:
// features
// - options: custom resolver
// complexity
// - import vue files without extension name
// - import js/css files with the same name

it('works', async () => {
  const { js: { filename: destFilename, content: jsCode }, css } = compile(mvp);
  expect(destFilename).toBe('anonymous.vue.js')
  expect(css?.filename).toBeTruthy()
  expect(css?.content).toBeTruthy()
  if (existsSync('./test/dist/mvp')) {
    rmSync('./test/dist/mvp', { recursive: true })
  }
  ensureDirSync('./test/dist/mvp')
  writeFileSync(`./test/dist/mvp/${destFilename}`, jsCode)
  writeFileSync(`./test/dist/mvp/${css!.filename}`, css!.content)
  const modulePath = `./dist/mvp/${destFilename}`
  const HelloWorld = (await import(modulePath)).default
  const wrapper = mount(defineComponent(HelloWorld))
  expect(wrapper.html().trim().replace(/\n/g, '')).toBe('<h1>Hello World!</h1><input>')
})

it('works without <style>', async () => {
  const { js: { filename: destFilename, content: jsCode }, css } = compile(nonCss);
  expect(destFilename).toBe('anonymous.vue.js')
  expect(css).toBeFalsy()
  if (existsSync('./test/dist/non-css')) {
    rmSync('./test/dist/non-css', { recursive: true })
  }
  ensureDirSync('./test/dist/non-css')
  writeFileSync(`./test/dist/non-css/${destFilename}`, jsCode)
  const modulePath = `./dist/non-css/${destFilename}`
  const HelloWorld = (await import(modulePath)).default
  const wrapper = mount(defineComponent(HelloWorld))
  expect(wrapper.html().trim().replace(/\n/g, '')).toBe('<h1>Hello World!</h1><input>')
})

it('works with custom filename', async () => {
  const { js: { filename: destFilename, content: jsCode }, css } = compile(mvp, { filename: 'custom.vue' });
  expect(destFilename).toBe('custom.vue.js')
  expect(css?.content).toBeTruthy()
  if (existsSync('./test/dist/custom-filename')) {
    rmSync('./test/dist/custom-filename', { recursive: true })
  }
  ensureDirSync('./test/dist/custom-filename')
  writeFileSync(`./test/dist/custom-filename/${destFilename}`, jsCode)
  writeFileSync(`./test/dist/custom-filename/${css!.filename}`, css!.content)
  const modulePath = `./dist/custom-filename/${destFilename}`
  const HelloWorld = (await import(modulePath)).default
  const wrapper = mount(defineComponent(HelloWorld))
  expect(wrapper.html().trim().replace(/\n/g, '')).toBe('<h1>Hello World!</h1><input>')
})

it('works with importing other vue files', async () => {
  const { js: { filename: destFilename, content: jsCode }, css } = compile(mvp, { filename: 'foo.vue' });
  const { js: { filename: destFilename2, content: jsCode2 }, css: css2 } = compile(imports, { filename: 'bar.vue' });
  expect(destFilename).toBe('foo.vue.js')
  expect(destFilename2).toBe('bar.vue.js')
  expect(css?.content).toBeTruthy()
  expect(css2?.content).toBeTruthy()
  if (existsSync('./test/dist/imports')) {
    rmSync('./test/dist/imports', { recursive: true })
  }
  ensureDirSync('./test/dist/imports')
  writeFileSync(`./test/dist/imports/${destFilename}`, jsCode)
  writeFileSync(`./test/dist/imports/${css!.filename}`, css!.content)
  writeFileSync(`./test/dist/imports/${destFilename2}`, jsCode2)
  writeFileSync(`./test/dist/imports/${css2!.filename}`, css2!.content)
  const modulePath = `./dist/imports/${destFilename2}`
  const Bar = (await import(modulePath)).default
  const wrapper = mount(defineComponent(Bar))
  expect(wrapper.html().trim().replace(/\n/g, '')).toBe('1<h1>Hello World!</h1><input>2')
})

it('works with auto-import css', async() => {
  const { js: { filename: destFilename, content: jsCode }, css } = compile(mvp, { filename: 'foo.vue', autoImportCss: true });
  expect(destFilename).toBe('foo.vue.js')
  expect(css?.content).toBeTruthy()
  expect(jsCode.includes(`import './foo.vue.css'`)).toBe(true)
  if (existsSync('./test/dist/auto-import-css')) {
    rmSync('./test/dist/auto-import-css', { recursive: true })
  }
  ensureDirSync('./test/dist/auto-import-css')
  writeFileSync(`./test/dist/auto-import-css/${destFilename}`, jsCode)
  writeFileSync(`./test/dist/auto-import-css/${css!.filename}`, css!.content)
  const modulePath = `./dist/auto-import-css/${destFilename}`
  const HelloWorld = (await import(modulePath)).default
  const wrapper = mount(defineComponent(HelloWorld))
  expect(wrapper.html().trim().replace(/\n/g, '')).toBe('<h1>Hello World!</h1><input>')
})

it('works with auto-import css without <style>', async() => {
  const { js: { filename: destFilename, content: jsCode }, css } = compile(nonCss, { filename: 'foo.vue', autoImportCss: true });
  expect(destFilename).toBe('foo.vue.js')
  expect(css).toBeFalsy()
  expect(jsCode.includes(`import './foo.vue.css'`)).toBe(false)
  if (existsSync('./test/dist/auto-import-non-css')) {
    rmSync('./test/dist/auto-import-non-css', { recursive: true })
  }
  ensureDirSync('./test/dist/auto-import-non-css')
  writeFileSync(`./test/dist/auto-import-non-css/${destFilename}`, jsCode)
  const modulePath = `./dist/auto-import-non-css/${destFilename}`
  const HelloWorld = (await import(modulePath)).default
  const wrapper = mount(defineComponent(HelloWorld))
  expect(wrapper.html().trim().replace(/\n/g, '')).toBe('<h1>Hello World!</h1><input>')
})

it('works with scoped CSS', async () => {
  const { js: { filename: destFilename, content: jsCode }, css, scopedCss } = compile(scoped, { filename: 'scoped.vue' });
  expect(destFilename).toBe('scoped.vue.js')
  expect(css).toBeFalsy()
  expect(scopedCss?.content).toBeTruthy()
  if (existsSync('./test/dist/scoped')) {
    rmSync('./test/dist/scoped', { recursive: true })
  }
  ensureDirSync('./test/dist/scoped')
  writeFileSync(`./test/dist/scoped/${destFilename}`, jsCode)
  writeFileSync(`./test/dist/scoped/${scopedCss!.filename}`, scopedCss!.content)
  const modulePath = `./dist/scoped/${destFilename}`
  const HelloWorld = (await import(modulePath)).default
  const wrapper = await mount(defineComponent(HelloWorld))
  expect(wrapper.element.childElementCount).equal(2)
  expect(wrapper.element.children[0].tagName).equal('H1')
  expect(wrapper.element.children[0].className).equal('title')
  expect(wrapper.element.children[0].textContent).equal('Hello World!')
  expect(wrapper.element.children[0].attributes.item(1)!.name).match(/^data\-v\-/)
  expect(wrapper.element.children[1].tagName).equal('INPUT')
  expect(wrapper.element.children[1].attributes.item(0)!.name)
    .equal(wrapper.element.children[0].attributes.item(1)!.name)
})
